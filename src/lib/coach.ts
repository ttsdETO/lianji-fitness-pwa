import type { AppData, PlanExercise, WeeklyPlanDay } from '../types'
import { getWeekStart, toLocalISODate } from './date'
import { resolveWeeklyPlanForDate } from './plan'

export const QWEN_CONFIG_KEY = 'lianji-qwen-config-v1'
export const QWEN_API_KEY_SESSION_KEY = 'lianji-qwen-api-key-session-v1'
export const COACH_MESSAGES_KEY = 'lianji-coach-messages-v1'
export const QWEN_API_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
export const MAX_COACH_PROMPT_LENGTH = 2000

export interface QwenConfig {
  apiKey: string
  model: 'qwen3.7-plus'
  shareDetailedContext: boolean
}

export interface CoachInsight {
  title: string
  detail: string
  tone: 'positive' | 'neutral' | 'warning'
}

export type CoachPlanField = 'sets' | 'repsMin' | 'repsMax' | 'restSeconds' | 'rir' | 'weightKg'

export interface CoachPlanChange {
  weekday: number
  exerciseId: string
  field: CoachPlanField
  value: number
  reason: string
}

export interface CoachPlanProposal {
  title: string
  rationale: string
  changes: CoachPlanChange[]
}

export interface CoachAssistantReply {
  reply: string
  insights: CoachInsight[]
  suggestions: string[]
  planProposal: CoachPlanProposal | null
}

export interface CoachUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface CoachMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  reply?: CoachAssistantReply
  usage?: CoachUsage
  error?: boolean
  proposalAppliedAt?: string
  proposalApplication?: CoachPlanApplication
  proposalUndoneAt?: string
}

export type CoachPlanScope = 'current-week' | 'all-future'

export interface CoachPlanApplication {
  scope: CoachPlanScope
  appliedAt: string
  weekStart: string
  beforeWeeklyPlan: WeeklyPlanDay[] | null
  beforeWeekOverride: WeeklyPlanDay[] | null
}

export interface ResolvedPlanChange extends CoachPlanChange {
  dayTitle: string
  exerciseName: string
  before: number
}

export interface ResolvedPlanProposal extends Omit<CoachPlanProposal, 'changes'> {
  changes: ResolvedPlanChange[]
}

export const DEFAULT_QWEN_CONFIG: QwenConfig = {
  apiKey: '',
  model: 'qwen3.7-plus',
  shareDetailedContext: false,
}

type MutableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const getLocalStorage = () => window.localStorage
const getSessionStorage = () => window.sessionStorage
const getStorage = getSessionStorage

const normalizeApiKey = (value: unknown) => typeof value === 'string' ? value.trim() : ''

export const getQwenApiKeyError = (value: string) => {
  const apiKey = normalizeApiKey(value)
  if (!apiKey) return '请先填写 API Key'
  if (apiKey.length > 256 || !/^sk-[A-Za-z0-9_-]{5,}$/.test(apiKey)) return 'API Key 格式不正确，请粘贴百炼控制台生成的 sk- 密钥'
  return null
}

export const loadQwenConfig = (
  localStorage: MutableStorage = getLocalStorage(),
  sessionStorage: MutableStorage = getSessionStorage(),
): QwenConfig => {
  let legacyApiKey = ''
  let shareDetailedContext = false
  try {
    const raw = localStorage.getItem(QWEN_CONFIG_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<QwenConfig>
      legacyApiKey = normalizeApiKey(parsed.apiKey)
      shareDetailedContext = parsed.shareDetailedContext === true
    }
  } catch {
    // Ignore malformed legacy config; session-scoped credentials can still be used.
  }

  const sessionApiKey = normalizeApiKey(sessionStorage.getItem(QWEN_API_KEY_SESSION_KEY))
  const apiKey = sessionApiKey || legacyApiKey

  // Security migration: move legacy credentials out of persistent storage.
  if (legacyApiKey) sessionStorage.setItem(QWEN_API_KEY_SESSION_KEY, legacyApiKey)
  localStorage.setItem(QWEN_CONFIG_KEY, JSON.stringify({ model: 'qwen3.7-plus', shareDetailedContext }))
  localStorage.removeItem(COACH_MESSAGES_KEY)

  return { apiKey, model: 'qwen3.7-plus', shareDetailedContext }
}

export const saveQwenConfig = (
  config: QwenConfig,
  localStorage: MutableStorage = getLocalStorage(),
  sessionStorage: MutableStorage = getSessionStorage(),
) => {
  localStorage.setItem(QWEN_CONFIG_KEY, JSON.stringify({ model: 'qwen3.7-plus', shareDetailedContext: config.shareDetailedContext }))
  const apiKey = normalizeApiKey(config.apiKey)
  if (apiKey) sessionStorage.setItem(QWEN_API_KEY_SESSION_KEY, apiKey)
  else sessionStorage.removeItem(QWEN_API_KEY_SESSION_KEY)
}

export const clearCoachStorage = (
  localStorage: MutableStorage = getLocalStorage(),
  sessionStorage: MutableStorage = getSessionStorage(),
) => {
  localStorage.removeItem(QWEN_CONFIG_KEY)
  localStorage.removeItem(COACH_MESSAGES_KEY)
  sessionStorage.removeItem(COACH_MESSAGES_KEY)
  sessionStorage.removeItem(QWEN_API_KEY_SESSION_KEY)
}

const isCoachMessage = (value: unknown): value is CoachMessage => {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<CoachMessage>
  return (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string' && typeof message.id === 'string' && typeof message.createdAt === 'string'
}

export const loadCoachMessages = (storage: Pick<Storage, 'getItem'> = getStorage()): CoachMessage[] => {
  try {
    const raw = storage.getItem(COACH_MESSAGES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isCoachMessage).slice(-40) : []
  } catch {
    return []
  }
}

export const saveCoachMessages = (messages: CoachMessage[], storage: Pick<Storage, 'setItem'> = getStorage()) => {
  storage.setItem(COACH_MESSAGES_KEY, JSON.stringify(messages.slice(-40)))
}

const clampText = (value: string | undefined, length = 240) => value?.trim().slice(0, length) || undefined

const calculateAge = (birthDate: string, referenceDate: string) => {
  const birth = new Date(`${birthDate}T00:00:00`)
  const reference = new Date(`${referenceDate}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null
  let age = reference.getFullYear() - birth.getFullYear()
  if (reference.getMonth() < birth.getMonth() || (reference.getMonth() === birth.getMonth() && reference.getDate() < birth.getDate())) age -= 1
  return Math.max(0, age)
}

const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : null

export const buildCoachContext = (
  data: AppData,
  referenceDate = new Date().toISOString().slice(0, 10),
  shareDetailedContext = false,
) => {
  const recentWorkouts = [...data.workouts].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()).slice(0, 6)
  const recentRecovery = [...data.recoveryRecords].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
  const recentBody = [...data.bodyRecords].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
  const completedSets = recentWorkouts.flatMap((workout) => workout.exercises.flatMap((exercise) => exercise.sets.filter((set) => set.completed)))
  const weeklyPlan = resolveWeeklyPlanForDate(data.settings, referenceDate)

  return {
    contextGeneratedAt: new Date().toISOString(),
    currentDate: referenceDate,
    privacyMode: shareDetailedContext ? 'detailed' : 'minimal',
    profile: {
      equipment: data.profile.equipment,
      ...(shareDetailedContext ? {
        age: calculateAge(data.profile.birthDate, referenceDate),
        heightCm: data.profile.height ?? null,
        baselineWeightKg: data.profile.baselineWeight ?? null,
        goalWeightKg: data.profile.goalWeight ?? null,
        proteinTargetG: [data.profile.proteinMin ?? null, data.profile.proteinMax ?? null],
        measurementsCm: {
        chest: data.profile.chest,
        waist: data.profile.waist,
        hips: data.profile.hips,
        upperArmLeft: data.profile.upperArmLeft,
        upperArmRight: data.profile.upperArmRight,
        thighLeft: data.profile.thighLeft,
        thighRight: data.profile.thighRight,
      },
      } : {}),
    },
    summary: {
      totalWorkouts: data.workouts.length,
      recentWorkoutCount: recentWorkouts.length,
      recentAverageCompletionPercent: average(recentWorkouts.map((workout) => workout.completionRate)),
      recentAverageRir: average(completedSets.map((set) => set.rir).filter((value): value is number => typeof value === 'number')),
      latestWeightKg: shareDetailedContext ? recentBody.find((record) => typeof record.weight === 'number')?.weight ?? null : null,
      latestRecovery: shareDetailedContext ? recentRecovery[0] ?? null : null,
    },
    weeklyPlan: weeklyPlan.map((day) => ({
      id: day.id,
      weekday: day.weekday,
      enabled: day.enabled,
      title: day.title,
      focus: day.focus,
      exercises: day.exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.nameSnapshot ?? exercise.name,
        category: exercise.category,
        equipment: exercise.equipment,
        sets: exercise.sets,
        repsMin: exercise.repsMin,
        repsMax: exercise.repsMax,
        unit: exercise.unit,
        restSeconds: exercise.restSeconds,
        weightKg: exercise.weightKg ?? null,
        rir: exercise.rir ?? 2,
        notes: shareDetailedContext ? clampText(exercise.notes, 120) : undefined,
      })),
    })),
    recentWorkouts: shareDetailedContext ? recentWorkouts.map((workout) => ({
      date: workout.date,
      planTitle: workout.planTitle,
      durationMinutes: workout.durationMinutes,
      completionRate: workout.completionRate,
      recoveryAdjustment: workout.recoveryAdjustment,
      note: clampText(workout.note),
      exercises: workout.exercises.map((exercise) => ({
        id: exercise.exerciseId,
        name: exercise.nameSnapshot ?? exercise.exerciseName,
        skipped: exercise.skipped,
        skipReason: clampText(exercise.skipReason, 100),
        sets: exercise.sets.map((set) => ({ reps: set.reps, weightKg: set.weightKg ?? null, rir: set.rir, completed: set.completed })),
      })),
    })) : [],
    recentRecovery: shareDetailedContext ? recentRecovery.map((record) => ({
      date: record.date,
      sleepHours: record.sleepHours,
      fatigue: record.fatigue,
      soreness: record.soreness,
      jointPain: record.jointPain,
      painArea: clampText(record.painArea, 100),
      note: clampText(record.note),
    })) : [],
    recentBodyRecords: shareDetailedContext ? recentBody.map((record) => ({
      date: record.date,
      weightKg: record.weight ?? null,
      chestCm: record.chest ?? null,
      waistCm: record.waist ?? null,
      hipsCm: record.hips ?? null,
      upperArmLeftCm: record.upperArmLeft ?? null,
      upperArmRightCm: record.upperArmRight ?? null,
      note: clampText(record.note),
    })) : [],
  }
}

export type CoachContext = ReturnType<typeof buildCoachContext>

const SYSTEM_PROMPT = `你是“练迹 AI 教练”，是本地优先健身记录 APP 的中文训练顾问。你会收到用户明确同意发送的 JSON 上下文。

工作原则：
1. 只依据上下文中的真实数据回答；数据不足时明确说明，不编造记录。
2. 优先给出具体、克制、能执行的建议，说明你引用了哪一项训练或恢复数据。
3. 用户的目标是健康增肌和稳定进步，不鼓励极端节食、快速减重、盲目加量或练到力竭。若用户未满 18 岁，营养建议以规律正餐、充足睡眠和监护人知情为前提。
4. 关节刺痛、锐痛、持续疼痛、胸痛、晕厥或呼吸异常时，明确建议停止相关训练并寻求监护人及专业医疗帮助；不要进行医学诊断。
5. 你可以提出训练计划调整，但不能声称已经修改 APP。只有用户明确询问计划、进度或调整时才生成 planProposal。
6. planProposal 只能修改上下文 weeklyPlan 中真实存在的 exercise id，且只允许修改 sets、repsMin、repsMax、restSeconds、rir、weightKg。不要新增、删除或替换动作。每次最多 6 项修改。
7. 数值边界：sets 1-10，repsMin/repsMax 1-100，restSeconds 15-600，rir 0-5，weightKg 0-250。

你必须只返回一个合法 JSON 对象，不能使用 Markdown 代码块，结构如下：
{
  "reply": "主要回答，使用简洁自然的中文，可分段但不要包含 Markdown 表格",
  "insights": [{"title":"短标题","detail":"有数据依据的一句话","tone":"positive|neutral|warning"}],
  "suggestions": ["用户接下来可以点击追问的问题"],
  "planProposal": null 或 {
    "title": "方案标题",
    "rationale": "为什么这样调整",
    "changes": [{"weekday":1,"exerciseId":"必须来自上下文的准确ID","field":"sets","value":3,"reason":"简短理由"}]
  }
}
insights 最多 3 项，suggestions 最多 3 项。`

interface QwenResponseBody {
  choices?: Array<{ message?: { content?: string } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

const extractJson = (content: string) => {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = (fenced ?? content).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  return start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate
}

const isTone = (value: unknown): value is CoachInsight['tone'] => value === 'positive' || value === 'neutral' || value === 'warning'
const PLAN_FIELDS: CoachPlanField[] = ['sets', 'repsMin', 'repsMax', 'restSeconds', 'rir', 'weightKg']

export const parseCoachReply = (content: string): CoachAssistantReply => {
  try {
    const parsed = JSON.parse(extractJson(content)) as Record<string, unknown>
    const reply = typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : content.trim()
    const insights = Array.isArray(parsed.insights) ? parsed.insights.flatMap((value) => {
      if (!value || typeof value !== 'object') return []
      const insight = value as Record<string, unknown>
      if (typeof insight.title !== 'string' || typeof insight.detail !== 'string') return []
      return [{ title: insight.title.slice(0, 60), detail: insight.detail.slice(0, 240), tone: isTone(insight.tone) ? insight.tone : 'neutral' }]
    }).slice(0, 3) : []
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).map((value) => value.trim().slice(0, 100)).slice(0, 3) : []
    let planProposal: CoachPlanProposal | null = null
    if (parsed.planProposal && typeof parsed.planProposal === 'object') {
      const proposal = parsed.planProposal as Record<string, unknown>
      const changes = Array.isArray(proposal.changes) ? proposal.changes.flatMap((value) => {
        if (!value || typeof value !== 'object') return []
        const change = value as Record<string, unknown>
        if (typeof change.exerciseId !== 'string' || !PLAN_FIELDS.includes(change.field as CoachPlanField)) return []
        const numericValue = Number(change.value)
        const weekday = Number(change.weekday)
        if (!Number.isFinite(numericValue) || !Number.isInteger(weekday)) return []
        return [{ weekday, exerciseId: change.exerciseId, field: change.field as CoachPlanField, value: numericValue, reason: typeof change.reason === 'string' ? change.reason.slice(0, 160) : '根据近期训练状态调整' }]
      }).slice(0, 6) : []
      if (changes.length) {
        planProposal = {
          title: typeof proposal.title === 'string' ? proposal.title.slice(0, 80) : '训练计划微调建议',
          rationale: typeof proposal.rationale === 'string' ? proposal.rationale.slice(0, 400) : '根据近期训练和恢复记录生成。',
          changes,
        }
      }
    }
    return { reply, insights, suggestions, planProposal }
  } catch {
    return { reply: content.trim() || '模型返回了空内容，请重新提问。', insights: [], suggestions: [], planProposal: null }
  }
}

const formatApiError = (status: number) => {
  if (status === 401) return 'API Key 无效或没有当前模型的调用权限。'
  if (status === 403) return '当前 API Key 无权调用 Qwen3.7-Plus，请检查百炼授权。'
  if (status === 429) return '请求过于频繁或账户额度不足，请稍后重试并检查百炼余额。'
  if (status === 400) return '请求参数不被百炼接口接受，请稍后重试。'
  if (status === 413) return '发送的训练上下文过大，请减少历史记录后重试。'
  if (status >= 500) return '百炼服务暂时不可用，请稍后重试。'
  return `百炼接口请求失败（${status}）。`
}

const QWEN_REQUEST_TIMEOUT_MS = 60_000
const MAX_QWEN_RESPONSE_BYTES = 1_000_000

const readQwenResponse = async (response: Response): Promise<QwenResponseBody> => {
  const declaredLength = Number(response.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_QWEN_RESPONSE_BYTES) {
    throw new Error('百炼接口返回内容过大，已停止处理。')
  }
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > MAX_QWEN_RESPONSE_BYTES) {
    throw new Error('百炼接口返回内容过大，已停止处理。')
  }
  if (!text) return {}
  try {
    return JSON.parse(text) as QwenResponseBody
  } catch {
    return {}
  }
}

const requestQwen = async (apiKey: string, payload: Record<string, unknown>, signal?: AbortSignal) => {
  const controller = new AbortController()
  let timedOut = false
  const abortFromCaller = () => controller.abort(signal?.reason)
  if (signal?.aborted) controller.abort(signal.reason)
  else signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, QWEN_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(QWEN_API_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    })
    return { response, body: await readQwenResponse(response) }
  } catch (error) {
    if (timedOut) throw new Error('AI 请求超过 60 秒，已安全停止，请稍后重试。')
    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}

export const requestCoachReply = async ({
  config,
  messages,
  data,
  enableThinking,
  signal,
}: {
  config: QwenConfig
  messages: CoachMessage[]
  data: AppData
  enableThinking: boolean
  signal?: AbortSignal
}) => {
  const context = buildCoachContext(data, toLocalISODate(), config.shareDetailedContext)
  const history = messages.filter((message) => !message.error).slice(-12).map((message) => ({
    role: message.role,
    content: (message.role === 'assistant' && message.reply ? JSON.stringify(message.reply) : message.content).slice(0, MAX_COACH_PROMPT_LENGTH),
  }))
  const { response, body } = await requestQwen(config.apiKey, {
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: `以下是 APP 当前生成的只读训练上下文：\n${JSON.stringify(context)}` },
        ...history,
      ],
      response_format: { type: 'json_object' },
      enable_thinking: enableThinking,
      ...(enableThinking ? { thinking_budget: 1400 } : {}),
      temperature: 0.35,
      max_tokens: 1800,
  }, signal)
  if (!response.ok) throw new Error(formatApiError(response.status))
  const content = body.choices?.[0]?.message?.content
  if (!content) throw new Error('百炼接口没有返回有效内容，请重新尝试。')
  return {
    reply: parseCoachReply(content),
    usage: {
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
      totalTokens: body.usage?.total_tokens ?? 0,
    } satisfies CoachUsage,
  }
}

export const testQwenConnection = async (config: QwenConfig, signal?: AbortSignal) => {
  const { response, body } = await requestQwen(config.apiKey, {
      model: config.model,
      messages: [{ role: 'user', content: '只回复“连接成功”四个字。' }],
      enable_thinking: false,
      max_tokens: 12,
  }, signal)
  if (!response.ok) throw new Error(formatApiError(response.status))
  if (!body.choices?.[0]?.message?.content) throw new Error('接口已响应，但没有返回文本。')
}

const FIELD_RANGES: Record<CoachPlanField, [number, number]> = {
  sets: [1, 10],
  repsMin: [1, 100],
  repsMax: [1, 100],
  restSeconds: [15, 600],
  rir: [0, 5],
  weightKg: [0, 250],
}

const getExerciseValue = (exercise: PlanExercise, field: CoachPlanField) => {
  if (field === 'rir') return exercise.rir ?? 2
  if (field === 'weightKg') return exercise.weightKg ?? 0
  return exercise[field]
}

export const resolvePlanProposal = (data: AppData, proposal: CoachPlanProposal | null, referenceDate = toLocalISODate()): ResolvedPlanProposal | null => {
  if (!proposal) return null
  const weeklyPlan = resolveWeeklyPlanForDate(data.settings, referenceDate)
  const changes = proposal.changes.flatMap((change) => {
    const day = weeklyPlan.find((item) => item.weekday === change.weekday)
    const exercise = day?.exercises.find((item) => item.id === change.exerciseId)
    const range = FIELD_RANGES[change.field]
    if (!day || !exercise || !range || change.value < range[0] || change.value > range[1]) return []
    const before = getExerciseValue(exercise, change.field)
    if (before === change.value) return []
    return [{ ...change, dayTitle: day.title, exerciseName: exercise.nameSnapshot ?? exercise.name, before }]
  }).slice(0, 6)
  return changes.length ? { title: proposal.title, rationale: proposal.rationale, changes } : null
}

const applyPlanChange = (exercise: PlanExercise, change: ResolvedPlanChange): PlanExercise => {
  const updated = { ...exercise, [change.field]: change.value }
  if (updated.repsMin > updated.repsMax) {
    if (change.field === 'repsMin') updated.repsMax = updated.repsMin
    else updated.repsMin = updated.repsMax
  }
  return updated
}

const cloneWeeklyPlan = (weeklyPlan: WeeklyPlanDay[]) => weeklyPlan.map((day) => ({
  ...day,
  exercises: day.exercises.map((exercise) => ({ ...exercise })),
}))

const applyProposalToWeeklyPlan = (weeklyPlan: WeeklyPlanDay[], proposal: ResolvedPlanProposal) => weeklyPlan.map((day) => ({
  ...day,
  exercises: day.exercises.map((exercise) => {
    const changes = proposal.changes.filter((change) => change.weekday === day.weekday && change.exerciseId === exercise.id)
    return changes.reduce(applyPlanChange, exercise)
  }),
}))

export const createCoachPlanApplication = (
  data: AppData,
  scope: CoachPlanScope,
  referenceDate = toLocalISODate(),
): CoachPlanApplication => {
  const weekStart = getWeekStart(referenceDate, data.settings.weekStartsOn)
  return {
    scope,
    appliedAt: new Date().toISOString(),
    weekStart,
    beforeWeeklyPlan: scope === 'all-future' ? cloneWeeklyPlan(data.settings.weeklyPlan) : null,
    beforeWeekOverride: data.settings.weeklyPlanOverrides[weekStart]
      ? cloneWeeklyPlan(data.settings.weeklyPlanOverrides[weekStart])
      : null,
  }
}

export const applyCoachPlanProposal = (
  data: AppData,
  proposal: ResolvedPlanProposal,
  scope: CoachPlanScope = 'all-future',
  referenceDate = toLocalISODate(),
): AppData => {
  const weekStart = getWeekStart(referenceDate, data.settings.weekStartsOn)
  const weeklyPlanOverrides = { ...data.settings.weeklyPlanOverrides }
  if (scope === 'current-week') {
    const effectivePlan = weeklyPlanOverrides[weekStart] ?? data.settings.weeklyPlan
    weeklyPlanOverrides[weekStart] = applyProposalToWeeklyPlan(effectivePlan, proposal)
    return { ...data, settings: { ...data.settings, weeklyPlanOverrides } }
  }

  if (weeklyPlanOverrides[weekStart]) {
    weeklyPlanOverrides[weekStart] = applyProposalToWeeklyPlan(weeklyPlanOverrides[weekStart], proposal)
  }
  return {
    ...data,
    settings: {
      ...data.settings,
      weeklyPlan: applyProposalToWeeklyPlan(data.settings.weeklyPlan, proposal),
      weeklyPlanOverrides,
    },
  }
}

export const undoCoachPlanApplication = (data: AppData, application: CoachPlanApplication): AppData => {
  const weeklyPlanOverrides = { ...data.settings.weeklyPlanOverrides }
  if (application.beforeWeekOverride) weeklyPlanOverrides[application.weekStart] = cloneWeeklyPlan(application.beforeWeekOverride)
  else delete weeklyPlanOverrides[application.weekStart]
  return {
    ...data,
    settings: {
      ...data.settings,
      weeklyPlan: application.beforeWeeklyPlan ? cloneWeeklyPlan(application.beforeWeeklyPlan) : data.settings.weeklyPlan,
      weeklyPlanOverrides,
    },
  }
}

export const COACH_FIELD_LABELS: Record<CoachPlanField, string> = {
  sets: '组数',
  repsMin: '最低次数',
  repsMax: '最高次数',
  restSeconds: '休息秒数',
  rir: '目标 RIR',
  weightKg: '重量 kg',
}
