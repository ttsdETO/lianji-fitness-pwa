import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyCoachPlanProposal,
  buildCoachContext,
  clearCoachStorage,
  COACH_MESSAGES_KEY,
  createCoachPlanApplication,
  getQwenApiKeyError,
  loadQwenConfig,
  parseCoachReply,
  QWEN_API_ENDPOINT,
  QWEN_API_KEY_SESSION_KEY,
  QWEN_CONFIG_KEY,
  requestCoachReply,
  resolvePlanProposal,
  saveQwenConfig,
  testQwenConnection,
  undoCoachPlanApplication,
} from '../src/lib/coach'
import { resolveWeeklyPlanForDate } from '../src/lib/plan'
import { createDefaultData } from '../src/lib/storage'

const createMemoryStorage = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AI 教练上下文与计划提案', () => {
  it('只向模型整理有限的近期数据并保留计划动作 ID', () => {
    const data = createDefaultData()
    data.workouts = Array.from({ length: 9 }, (_, index) => ({
      id: `workout-${index}`,
      date: `2026-07-${String(20 - index).padStart(2, '0')}`,
      planId: 'test',
      planTitle: '测试训练',
      startedAt: '2026-07-20T10:00:00.000Z',
      completedAt: '2026-07-20T10:30:00.000Z',
      durationMinutes: 30,
      completionRate: 90,
      recoveryAdjustment: 'none' as const,
      note: '',
      exercises: [],
    }))
    const context = buildCoachContext(data, '2026-07-22')
    const firstExercise = data.settings.weeklyPlan.find((day) => day.enabled)?.exercises[0]
    expect(context.summary.totalWorkouts).toBe(9)
    expect(context.weeklyPlan.flatMap((day) => day.exercises).some((exercise) => exercise.id === firstExercise?.id)).toBe(true)
    expect(context.privacyMode).toBe('minimal')
    expect(context.profile).not.toHaveProperty('name')
    expect(context.profile).not.toHaveProperty('age')
    expect(context.recentWorkouts).toEqual([])
    expect(context.recentRecovery).toEqual([])
    expect(context.recentBodyRecords).toEqual([])
  })

  it('只有主动开启详细模式才整理身体与恢复记录，且始终不发送姓名', () => {
    const data = createDefaultData()
    data.profile.name = '不应发送的姓名'
    data.profile.birthDate = '2000-01-01'
    data.bodyRecords = [{ id: 'body-test', date: '2026-07-21', weight: 65, note: '敏感备注' }]
    data.recoveryRecords = [{ id: 'recovery-test', date: '2026-07-21', sleepHours: 7, fatigue: 2, soreness: 1, jointPain: false, painArea: '', note: '恢复备注' }]

    const context = buildCoachContext(data, '2026-07-22', true)

    expect(context.privacyMode).toBe('detailed')
    expect(context.profile).not.toHaveProperty('name')
    expect(context.profile).toHaveProperty('age', 26)
    expect(context.recentBodyRecords).toHaveLength(1)
    expect(context.recentRecovery).toHaveLength(1)
  })

  it('最少数据模式的真实请求体不包含姓名、身体记录或自由文本备注', async () => {
    const data = createDefaultData()
    data.profile.name = 'PRIVATE_NAME_MARKER'
    data.bodyRecords = [{ id: 'body-private', date: '2026-07-21', weight: 65, note: 'PRIVATE_BODY_NOTE' }]
    data.recoveryRecords = [{ id: 'recovery-private', date: '2026-07-21', sleepHours: 6.5, fatigue: 3, soreness: 2, jointPain: true, painArea: 'PRIVATE_PAIN_AREA', note: 'PRIVATE_RECOVERY_NOTE' }]
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ reply: '已收到', insights: [], suggestions: [], planProposal: null }) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await requestCoachReply({
      config: { apiKey: 'sk-secure-test-key', model: 'qwen3.7-plus', shareDetailedContext: false },
      messages: [{ id: 'message-1', role: 'user', content: '检查计划', createdAt: '2026-07-22T10:00:00.000Z' }],
      data,
      enableThinking: false,
    })

    const request = fetchMock.mock.calls[0][1] as RequestInit
    const body = String(request.body)
    expect(body).not.toContain('PRIVATE_NAME_MARKER')
    expect(body).not.toContain('PRIVATE_BODY_NOTE')
    expect(body).not.toContain('PRIVATE_PAIN_AREA')
    expect(body).not.toContain('PRIVATE_RECOVERY_NOTE')
  })

  it('解析 JSON 回复并过滤不受支持的计划字段', () => {
    const reply = parseCoachReply(JSON.stringify({
      reply: '保持动作稳定。',
      insights: [{ title: '恢复正常', detail: '睡眠记录支持按计划训练。', tone: 'positive' }],
      suggestions: ['要不要检查计划？'],
      planProposal: {
        title: '轻微减量',
        rationale: '近期疲劳偏高',
        changes: [
          { weekday: 1, exerciseId: 'exercise-a', field: 'sets', value: 2, reason: '控制疲劳' },
          { weekday: 1, exerciseId: 'exercise-a', field: 'delete', value: 1, reason: '不允许' },
        ],
      },
    }))
    expect(reply.reply).toBe('保持动作稳定。')
    expect(reply.insights[0].tone).toBe('positive')
    expect(reply.planProposal?.changes).toHaveLength(1)
  })

  it('只应用命中真实动作且处于安全范围内的数值修改', () => {
    const data = createDefaultData()
    const day = data.settings.weeklyPlan.find((item) => item.enabled)!
    const exercise = day.exercises[0]
    const targetSets = exercise.sets === 2 ? 3 : 2
    const resolved = resolvePlanProposal(data, {
      title: '组数微调',
      rationale: '测试',
      changes: [
        { weekday: day.weekday, exerciseId: exercise.id, field: 'sets', value: targetSets, reason: '有效修改' },
        { weekday: day.weekday, exerciseId: 'missing-id', field: 'sets', value: 3, reason: '不存在' },
        { weekday: day.weekday, exerciseId: exercise.id, field: 'rir', value: 9, reason: '超出范围' },
      ],
    })
    expect(resolved?.changes).toHaveLength(1)
    const updated = applyCoachPlanProposal(data, resolved!)
    const updatedExercise = updated.settings.weeklyPlan.find((item) => item.weekday === day.weekday)?.exercises.find((item) => item.id === exercise.id)
    expect(updatedExercise?.sets).toBe(targetSets)
    expect(data.settings.weeklyPlan.find((item) => item.weekday === day.weekday)?.exercises[0].sets).toBe(exercise.sets)
  })

  it('仅本周修改写入周级计划，跨周恢复默认且可以撤回', () => {
    const data = createDefaultData()
    const day = data.settings.weeklyPlan.find((item) => item.enabled)!
    const exercise = day.exercises[0]
    const targetSets = exercise.sets === 2 ? 3 : 2
    const referenceDate = '2026-07-22'
    const resolved = resolvePlanProposal(data, {
      title: '本周减量',
      rationale: '测试周级覆盖',
      changes: [{ weekday: day.weekday, exerciseId: exercise.id, field: 'sets', value: targetSets, reason: '只测试本周' }],
    }, referenceDate)!
    const application = createCoachPlanApplication(data, 'current-week', referenceDate)
    const updated = applyCoachPlanProposal(data, resolved, 'current-week', referenceDate)

    expect(updated.settings.weeklyPlan[0].exercises[0].sets).toBe(exercise.sets)
    expect(updated.settings.weeklyPlanOverrides['2026-07-20']).toHaveLength(7)
    expect(resolveWeeklyPlanForDate(updated.settings, referenceDate).find((item) => item.weekday === day.weekday)?.exercises[0].sets).toBe(targetSets)
    expect(resolveWeeklyPlanForDate(updated.settings, '2026-07-27').find((item) => item.weekday === day.weekday)?.exercises[0].sets).toBe(exercise.sets)

    const restored = undoCoachPlanApplication(updated, application)
    expect(restored.settings.weeklyPlanOverrides['2026-07-20']).toBeUndefined()
    expect(resolveWeeklyPlanForDate(restored.settings, referenceDate).find((item) => item.weekday === day.weekday)?.exercises[0].sets).toBe(exercise.sets)
  })

  it('永久修改会更新默认计划并可原样撤回', () => {
    const data = createDefaultData()
    const day = data.settings.weeklyPlan.find((item) => item.enabled)!
    const exercise = day.exercises[0]
    const targetSets = exercise.sets === 2 ? 3 : 2
    const resolved = resolvePlanProposal(data, {
      title: '永久调整',
      rationale: '测试',
      changes: [{ weekday: day.weekday, exerciseId: exercise.id, field: 'sets', value: targetSets, reason: '测试' }],
    }, '2026-07-22')!
    const application = createCoachPlanApplication(data, 'all-future', '2026-07-22')
    const updated = applyCoachPlanProposal(data, resolved, 'all-future', '2026-07-22')
    expect(updated.settings.weeklyPlan.find((item) => item.weekday === day.weekday)?.exercises[0].sets).toBe(targetSets)
    const restored = undoCoachPlanApplication(updated, application)
    expect(restored.settings.weeklyPlan.find((item) => item.weekday === day.weekday)?.exercises[0].sets).toBe(exercise.sets)
  })

  it('把旧版持久化 API Key 迁移到会话存储并丢弃自定义接口', () => {
    const localStorage = createMemoryStorage({
      [QWEN_CONFIG_KEY]: JSON.stringify({
        apiKey: 'sk-legacy-test-key',
        baseUrl: 'https://attacker.example/v1',
        model: 'qwen3.7-plus',
      }),
    })
    const sessionStorage = createMemoryStorage()

    const config = loadQwenConfig(localStorage, sessionStorage)

    expect(config).toEqual({ apiKey: 'sk-legacy-test-key', model: 'qwen3.7-plus', shareDetailedContext: false })
    expect(sessionStorage.getItem(QWEN_API_KEY_SESSION_KEY)).toBe('sk-legacy-test-key')
    expect(JSON.parse(localStorage.getItem(QWEN_CONFIG_KEY)!)).toEqual({ model: 'qwen3.7-plus', shareDetailedContext: false })
    expect(localStorage.getItem(QWEN_CONFIG_KEY)).not.toContain('attacker.example')
    expect(localStorage.getItem(QWEN_CONFIG_KEY)).not.toContain('sk-legacy-test-key')
  })

  it('只把 API Key 保存到当前会话并支持清除', () => {
    const localStorage = createMemoryStorage()
    const sessionStorage = createMemoryStorage()

    saveQwenConfig({ apiKey: 'sk-session-test-key', model: 'qwen3.7-plus', shareDetailedContext: false }, localStorage, sessionStorage)

    expect(localStorage.getItem(QWEN_CONFIG_KEY)).toBe('{"model":"qwen3.7-plus","shareDetailedContext":false}')
    expect(sessionStorage.getItem(QWEN_API_KEY_SESSION_KEY)).toBe('sk-session-test-key')

    saveQwenConfig({ apiKey: '', model: 'qwen3.7-plus', shareDetailedContext: false }, localStorage, sessionStorage)
    expect(sessionStorage.getItem(QWEN_API_KEY_SESSION_KEY)).toBeNull()
  })

  it('清空本机数据时同时移除 AI 配置、会话和 API Key', () => {
    const localStorage = createMemoryStorage({
      [QWEN_CONFIG_KEY]: '{"model":"qwen3.7-plus"}',
      [COACH_MESSAGES_KEY]: '[{"role":"user"}]',
    })
    const sessionStorage = createMemoryStorage({ [QWEN_API_KEY_SESSION_KEY]: 'sk-session-test-key' })

    clearCoachStorage(localStorage, sessionStorage)

    expect(localStorage.getItem(QWEN_CONFIG_KEY)).toBeNull()
    expect(localStorage.getItem(COACH_MESSAGES_KEY)).toBeNull()
    expect(sessionStorage.getItem(QWEN_API_KEY_SESSION_KEY)).toBeNull()
  })

  it('校验百炼 API Key 格式', () => {
    expect(getQwenApiKeyError('')).toBe('请先填写 API Key')
    expect(getQwenApiKeyError('not-a-key')).toContain('格式不正确')
    expect(getQwenApiKeyError('sk-valid_test-key')).toBeNull()
  })

  it('只向固定官方端点发送无凭据、无缓存且禁止重定向的请求', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '连接成功' } }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await testQwenConnection({ apiKey: 'sk-secure-test-key', model: 'qwen3.7-plus', shareDetailedContext: false })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(QWEN_API_ENDPOINT, expect.objectContaining({
      method: 'POST',
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    }))
    const request = fetchMock.mock.calls[0][1] as RequestInit
    expect(request.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer sk-secure-test-key' }))
    expect(JSON.stringify(request.body)).not.toContain('sk-secure-test-key')
  })

  it('不把服务端原始错误内容回显给用户', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'internal-secret-provider-message' },
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })))

    await expect(testQwenConnection({ apiKey: 'sk-secure-test-key', model: 'qwen3.7-plus', shareDetailedContext: false }))
      .rejects.toThrow('请求参数不被百炼接口接受')
  })
})
