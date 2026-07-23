import { describe, expect, it } from 'vitest'
import { abdominalStretching, findExercise, getPlanForWeekday, getPostWorkoutStretching, lowerBodyStretching, optionalPerformanceExercise, trainingPlan, upperBodyStretching, warmup } from '../src/data/workoutPlan'
import { createBilibiliTutorial, defaultExerciseTutorials, parseBilibiliVideoId } from '../src/data/exerciseTutorials'
import { findClosestDatabaseExercise, findDatabaseExercise } from '../src/data/exerciseDatabase'
import { createDefaultWeeklyPlan, createWorkoutExerciseRecord, movePlanExercise, normalizeWeeklyPlan, resolveTrainingDay, syncWorkoutDraftWithPlan } from '../src/lib/plan'
import type { WorkoutDraft } from '../src/types'

describe('结构化训练计划', () => {
  it('按周一、周二、周四、周六提供四个训练日', () => {
    expect(trainingPlan.map((day) => day.weekday)).toEqual([1, 2, 4, 6])
    expect(getPlanForWeekday(1)?.title).toBe('上肢 A')
    expect(getPlanForWeekday(3)).toBeUndefined()
  })

  it('完整读取 26 个动作且每个动作都有可执行参数和安全提示，但今日详情不再携带视频', () => {
    const exercises = trainingPlan.flatMap((day) => day.exercises)
    expect(exercises).toHaveLength(26)
    exercises.forEach((exercise) => {
      expect(exercise.sets).toBeGreaterThan(0)
      expect(exercise.repsMax).toBeGreaterThanOrEqual(exercise.repsMin)
      expect(exercise.restSeconds).toBeGreaterThanOrEqual(60)
      expect(exercise.steps.length).toBeGreaterThanOrEqual(3)
      expect(exercise.painWarning.length).toBeGreaterThan(8)
      expect('tutorial' in exercise).toBe(false)
    })
    expect('tutorial' in optionalPerformanceExercise).toBe(false)
  })

  it('旧教程已迁移到数据库动作并能解析 B 站链接', () => {
    expect(Object.keys(defaultExerciseTutorials)).toHaveLength(24)
    Object.entries(defaultExerciseTutorials).forEach(([exerciseId, tutorial]) => {
      expect(findDatabaseExercise(exerciseId), exerciseId).toBeDefined()
      expect(tutorial.url).toContain('bilibili.com/video/')
    })
    expect(parseBilibiliVideoId('https://www.bilibili.com/video/BV1eF3tzjEMk/?spm_id_from=333')).toBe('BV1eF3tzjEMk')
    expect(createBilibiliTutorial('av370085991', '俯卧撑')?.videoId).toBe('av370085991')
    expect(createBilibiliTutorial('https://example.com/video', '无效')).toBeUndefined()
  })

  it('保留关键动作的原计划目标', () => {
    expect(findExercise('strict-pull-up-a')).toMatchObject({ sets: 3, repsMin: 4, repsMax: 5, restSeconds: 150 })
    expect(findExercise('goblet-squat')).toMatchObject({ sets: 3, repsMin: 15, repsMax: 20, tempo: '下降 3 秒，底部停 1 秒' })
    expect(findExercise('side-plank')).toMatchObject({ unit: '秒', perSide: true })
  })

  it('六项通用热身均有文字详解且不包含视频', () => {
    expect(warmup).toHaveLength(6)
    warmup.forEach((item) => {
      expect(item.steps.length).toBeGreaterThanOrEqual(3)
      expect(item.tips.length).toBeGreaterThanOrEqual(2)
      expect(item.mistakes.length).toBeGreaterThanOrEqual(2)
      expect(item.phase).toBe('warmup')
      expect(findDatabaseExercise(item.databaseExerciseId), item.name).toBeDefined()
      expect('tutorial' in item).toBe(false)
    })
  })

  it('拉伸完整关联动作库并按上肢、下肢和核心自动匹配', () => {
    const allStretches = [...upperBodyStretching, ...lowerBodyStretching, abdominalStretching]
    expect(allStretches).toHaveLength(10)
    allStretches.forEach((item) => {
      expect(item.phase).toBe('stretch')
      expect(findDatabaseExercise(item.databaseExerciseId)?.name).toBe(item.name)
      expect(item.steps.length).toBeGreaterThanOrEqual(3)
    })
    const upper = getPostWorkoutStretching(resolveTrainingDay(createDefaultWeeklyPlan(), 1)!.exercises)
    const lower = getPostWorkoutStretching(resolveTrainingDay(createDefaultWeeklyPlan(), 2)!.exercises)
    expect(upper.map((item) => item.databaseExerciseId)).toEqual([
      'doorway-chest-stretch', 'wall-lat-stretch', 'cross-body-shoulder-stretch', 'overhead-triceps-stretch', 'prone-abdominal-stretch',
    ])
    expect(lower.map((item) => item.databaseExerciseId)).toEqual([
      'standing-quad-stretch', 'supine-hamstring-stretch', 'figure-four-stretch', 'standing-hip-flexor-stretch', 'wall-calf-stretch', 'prone-abdominal-stretch',
    ])
  })

  it('把原计划迁移为周一至周日七天日历', () => {
    const weeklyPlan = createDefaultWeeklyPlan()
    expect(weeklyPlan.map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(weeklyPlan.filter((day) => day.enabled)).toHaveLength(4)
    expect(resolveTrainingDay(weeklyPlan, 3)).toBeUndefined()
    expect(resolveTrainingDay(weeklyPlan, 2)?.title).toBe('下肢 A')
    expect(weeklyPlan.flatMap((day) => day.exercises).every((exercise) => Boolean(exercise.exerciseId))).toBe(true)
  })

  it('自定义倒计时动作会同步为今日可执行计划', () => {
    const weeklyPlan = createDefaultWeeklyPlan()
    const monday = weeklyPlan.find((day) => day.weekday === 1)!
    monday.exercises.push({
      id: 'custom-timer', name: '静态支撑', category: '核心', equipment: '瑜伽垫', sets: 2,
      repsMin: 35, repsMax: 35, unit: '秒', perSide: false, restSeconds: 60, timerSeconds: 35,
    })
    const normalized = normalizeWeeklyPlan(weeklyPlan)
    expect(resolveTrainingDay(normalized, 1)?.exercises.at(-1)).toMatchObject({ name: '前臂平板支撑', databaseExerciseId: 'forearm-plank', unit: '秒', timerSeconds: 35 })
  })

  it('旧手填动作会强制关联最接近的数据库动作并保留训练参数', () => {
    const weeklyPlan = createDefaultWeeklyPlan()
    const monday = weeklyPlan.find((day) => day.weekday === 1)!
    monday.exercises = [
      { id: 'legacy-match', name: '站姿俯卧撑', category: '辅助', equipment: '墙面', sets: 2, repsMin: 10, repsMax: 12, unit: '次', perSide: false, restSeconds: 60 },
      { id: 'legacy-custom', name: '我的康复动作', category: '辅助', equipment: '毛巾', sets: 2, repsMin: 8, repsMax: 8, unit: '次', perSide: false, restSeconds: 45 },
    ]
    const normalized = normalizeWeeklyPlan(weeklyPlan)
    const migrated = normalized.find((day) => day.weekday === 1)!.exercises
    expect(migrated[0]).toMatchObject({ exerciseId: 'wall-push-up', nameSnapshot: '墙面俯卧撑', customExercise: false, sets: 2, repsMin: 10, restSeconds: 60 })
    expect(migrated[1].exerciseId).toBeTruthy()
    expect(migrated[1]).toMatchObject({ customExercise: false, sets: 2, repsMin: 8, repsMax: 8, restSeconds: 45 })
    expect(migrated[1].nameSnapshot).not.toBe('我的康复动作')
    expect(findClosestDatabaseExercise({ name: '扶墙分腿蹲', equipment: '墙面', category: '复合' }).id).toBe('split-squat')
  })

  it('自定义计划动作可重排且参数快照保持不变', () => {
    const exercises = createDefaultWeeklyPlan().find((day) => day.weekday === 1)!.exercises.slice(0, 3)
    const moved = movePlanExercise(exercises, 2, 0)
    expect(moved.map((item) => item.id)).toEqual([exercises[2].id, exercises[0].id, exercises[1].id])
    expect(moved.map((item) => item.order)).toEqual([0, 1, 2])
    expect(moved[0].nameSnapshot).toBe(exercises[2].nameSnapshot)
  })

  it('计划新增动作会安全追加到已有训练草稿且保留已记录组', () => {
    const plan = resolveTrainingDay(createDefaultWeeklyPlan(), 1)!
    const firstRecord = createWorkoutExerciseRecord(plan.exercises[0])
    firstRecord.sets[0] = { ...firstRecord.sets[0], reps: 12, rir: 1, completed: true }
    const draft: WorkoutDraft = {
      id: 'draft-sync', date: '2026-07-20', planId: plan.id, planTitle: plan.title,
      startedAt: '2026-07-20T08:00:00.000Z', updatedAt: '2026-07-20T08:10:00.000Z',
      recoveryAdjustment: 'none', note: '', exercises: [firstRecord],
    }
    const synced = syncWorkoutDraftWithPlan(draft, plan)
    expect(synced.exercises).toHaveLength(plan.exercises.length)
    expect(synced.exercises[0].sets[0]).toMatchObject({ reps: 12, rir: 1, completed: true })
    expect(syncWorkoutDraftWithPlan(synced, plan)).toBe(synced)
  })
})
