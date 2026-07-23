import { findClosestDatabaseExercise, findDatabaseExercise, findDatabaseExerciseByName, type DatabaseExercise } from '../data/exerciseDatabase'
import { findExercise, trainingPlan } from '../data/workoutPlan'
import { getWeekStart, getWeekdayName } from './date'
import type { AppSettings, Exercise, ExerciseOverride, PlanExercise, TrainingDay, WeeklyPlanDay, WorkoutDraft, WorkoutExerciseRecord } from '../types'

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const

const positiveInt = (value: unknown, fallback: number, min = 1, max = 999) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback
}

const nonNegativeNumber = (value: unknown, fallback = 0, max = 999) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(max, number)) : fallback
}

const mapDatabaseCategory = (category: string): Exercise['category'] => {
  if (category === '核心') return '核心'
  if (category === '心肺与爆发') return '性能'
  if (category === '上肢推' || category === '上肢拉' || category === '下肢') return '复合'
  return '辅助'
}

const sourceDatabaseExerciseIds: Record<string, string> = {
  'strict-pull-up-a': 'strict-pull-up',
  'strict-pull-up-b': 'strict-pull-up',
  'incline-push-up': 'incline-push-up',
  'one-arm-row-a': 'single-arm-dumbbell-row',
  'one-arm-row-b': 'single-arm-dumbbell-row',
  'floor-press': 'dumbbell-floor-press',
  'lateral-raise': 'dumbbell-lateral-raise',
  'reverse-crunch': 'reverse-crunch',
  'front-squat': 'dumbbell-front-squat',
  'romanian-deadlift': 'romanian-deadlift',
  'split-squat-a': 'split-squat',
  'split-squat-b': 'split-squat',
  'calf-raise-a': 'standing-calf-raise',
  'dead-bug': 'dead-bug',
  'side-plank': 'side-plank',
  'pike-push-up': 'pike-push-up',
  'eccentric-push-up': 'eccentric-push-up',
  'hammer-curl': 'hammer-curl',
  'overhead-triceps': 'overhead-triceps-extension',
  'hanging-knee-raise': 'hanging-knee-raise',
  'goblet-squat': 'goblet-squat',
  'single-leg-rdl': 'single-leg-romanian-deadlift',
  'weighted-glute-bridge': 'weighted-glute-bridge',
  'single-calf-raise': 'single-leg-calf-raise',
  'dumbbell-crunch': 'dumbbell-crunch',
  'bird-dog': 'bird-dog',
  'vertical-jump': 'vertical-jump',
}

const findDatabaseExerciseForSource = (exercise: Exercise) => findDatabaseExercise(sourceDatabaseExerciseIds[exercise.id])
  ?? findDatabaseExerciseByName(exercise.name)
  ?? findClosestDatabaseExercise({ name: exercise.name, equipment: exercise.equipment, category: exercise.category })

export const parseExercisePrescription = (reps: string) => {
  const values = (reps.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
  const unit = /秒|分钟/.test(reps) ? '秒' as const : '次' as const
  const minuteMultiplier = /分钟/.test(reps) ? 60 : 1
  const repsMin = Math.max(1, Math.round((values[0] ?? 10) * minuteMultiplier))
  const repsMax = Math.max(repsMin, Math.round((values.at(-1) ?? repsMin) * minuteMultiplier))
  return {
    unit,
    repsMin,
    repsMax,
    timerSeconds: unit === '秒' ? repsMin : undefined,
    perSide: /每侧|单侧|\/侧/.test(reps),
  }
}

export const createPlanExerciseFromDatabase = (exercise: DatabaseExercise, id = `plan-${exercise.id}-${Date.now()}`): PlanExercise => {
  const prescription = parseExercisePrescription(exercise.defaultPrescription.reps)
  return {
    id,
    exerciseId: exercise.id,
    name: exercise.name,
    nameSnapshot: exercise.name,
    category: mapDatabaseCategory(exercise.category),
    databaseCategory: exercise.category,
    equipment: exercise.equipment.join('、'),
    sets: exercise.defaultPrescription.sets,
    repsMin: prescription.repsMin,
    repsMax: prescription.repsMax,
    unit: prescription.unit,
    perSide: exercise.unilateral || prescription.perSide,
    restSeconds: exercise.defaultPrescription.restSeconds,
    timerSeconds: prescription.timerSeconds,
    weightKg: 0,
    weightMode: 'each',
    rir: exercise.defaultPrescription.rir,
    notes: '',
    customExercise: false,
  }
}

const toPlanExercise = (exercise: Exercise, override: ExerciseOverride = {}): PlanExercise => {
  const databaseExercise = findDatabaseExerciseForSource(exercise)
  return {
    id: exercise.id,
    sourceExerciseId: exercise.id,
    exerciseId: databaseExercise?.id,
    name: databaseExercise.name,
    nameSnapshot: databaseExercise.name,
    category: mapDatabaseCategory(databaseExercise.category),
    databaseCategory: databaseExercise.category,
    equipment: databaseExercise.equipment.join('、'),
    sets: override.sets ?? exercise.sets,
    repsMin: override.repsMin ?? exercise.repsMin,
    repsMax: override.repsMax ?? exercise.repsMax,
    unit: exercise.unit,
    perSide: Boolean(exercise.perSide),
    restSeconds: override.restSeconds ?? exercise.restSeconds,
    timerSeconds: exercise.unit === '秒' ? exercise.timerSeconds ?? override.repsMin ?? exercise.repsMin : undefined,
    weightKg: Number(exercise.weight?.match(/[\d.]+/)?.[0] ?? 0),
    weightMode: 'each',
    rir: 2,
    notes: '',
    customExercise: false,
  }
}

export const createDefaultWeeklyPlan = (overrides: Record<string, ExerciseOverride> = {}): WeeklyPlanDay[] => WEEKDAYS.map((weekday) => {
  const source = trainingPlan.find((day) => day.weekday === weekday)
  return {
    id: source?.id ?? `day-${weekday}`,
    weekday,
    enabled: Boolean(source),
    title: source?.title ?? `${getWeekdayName(weekday)}训练`,
    focus: source?.focus ?? '自定义训练内容',
    exercises: source?.exercises.map((item, index) => ({ ...toPlanExercise(item, overrides[item.id]), order: index })) ?? [],
  }
})

export const normalizeWeeklyPlan = (value: unknown, overrides: Record<string, ExerciseOverride> = {}): WeeklyPlanDay[] => {
  const defaults = createDefaultWeeklyPlan(overrides)
  if (!Array.isArray(value)) return defaults
  return defaults.map((fallback) => {
    const candidate = value.find((item) => item && typeof item === 'object' && Number((item as Partial<WeeklyPlanDay>).weekday) === fallback.weekday) as Partial<WeeklyPlanDay> | undefined
    if (!candidate) return fallback
    const exercises = Array.isArray(candidate.exercises) ? candidate.exercises.map((raw, index) => {
      const item = raw as Partial<PlanExercise>
      const source = findExercise(item.sourceExerciseId ?? item.id ?? '')
      const snapshot = typeof item.nameSnapshot === 'string' && item.nameSnapshot.trim()
        ? item.nameSnapshot.trim()
        : typeof item.name === 'string' && item.name.trim() ? item.name.trim() : undefined
      const linkedDatabaseExercise = findDatabaseExercise(item.exerciseId)
      const databaseExercise = linkedDatabaseExercise
        ?? (source ? findDatabaseExerciseForSource(source) : undefined)
        ?? findDatabaseExerciseByName(snapshot)
        ?? findClosestDatabaseExercise({ name: snapshot, equipment: item.equipment, category: item.category })
      const base = source ? toPlanExercise(source, overrides[source.id]) : databaseExercise ? createPlanExerciseFromDatabase(databaseExercise, item.id) : undefined
      const unit = item.unit === '秒' ? '秒' : base?.unit ?? '次'
      const repsMin = positiveInt(item.repsMin, base?.repsMin ?? 10)
      const wasUnlinked = !linkedDatabaseExercise
      const name = wasUnlinked ? databaseExercise.name : snapshot ?? databaseExercise.name
      return {
        id: typeof item.id === 'string' && item.id ? item.id : `custom-${fallback.weekday}-${index}`,
        sourceExerciseId: typeof item.sourceExerciseId === 'string' ? item.sourceExerciseId : base?.sourceExerciseId,
        exerciseId: databaseExercise?.id,
        name,
        nameSnapshot: name,
        category: wasUnlinked ? mapDatabaseCategory(databaseExercise.category) : item.category === '复合' || item.category === '核心' || item.category === '性能' ? item.category : base?.category ?? '辅助',
        databaseCategory: wasUnlinked ? databaseExercise.category : typeof item.databaseCategory === 'string' ? item.databaseCategory : databaseExercise.category,
        equipment: wasUnlinked ? databaseExercise.equipment.join('、') : typeof item.equipment === 'string' ? item.equipment : base?.equipment ?? databaseExercise.equipment.join('、'),
        sets: positiveInt(item.sets, base?.sets ?? 3, 1, 10),
        repsMin,
        repsMax: positiveInt(item.repsMax, base?.repsMax ?? repsMin, repsMin),
        unit,
        perSide: typeof item.perSide === 'boolean' ? item.perSide : Boolean(base?.perSide),
        restSeconds: positiveInt(item.restSeconds, base?.restSeconds ?? 90, 0, 600),
        timerSeconds: unit === '秒' ? positiveInt(item.timerSeconds, base?.timerSeconds ?? repsMin, 5, 3600) : undefined,
        weightKg: nonNegativeNumber(item.weightKg, base?.weightKg ?? 0),
        weightMode: item.weightMode === 'total' ? 'total' : 'each',
        rir: positiveInt(item.rir, base?.rir ?? databaseExercise?.defaultPrescription.rir ?? 2, 0, 10),
        notes: typeof item.notes === 'string' ? item.notes : '',
        order: index,
        customExercise: false,
      } satisfies PlanExercise
    }) : fallback.exercises
    return {
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id : fallback.id,
      weekday: fallback.weekday,
      enabled: typeof candidate.enabled === 'boolean' ? candidate.enabled : fallback.enabled,
      title: typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title : fallback.title,
      focus: typeof candidate.focus === 'string' ? candidate.focus : fallback.focus,
      exercises,
    }
  })
}

const makeCustomExercise = (item: PlanExercise): Exercise => ({
  id: item.id,
  databaseExerciseId: item.exerciseId,
  name: item.nameSnapshot ?? item.name,
  category: item.category,
  equipment: item.equipment || '自定义',
  sets: item.sets,
  repsMin: item.unit === '秒' ? item.timerSeconds ?? item.repsMin : item.repsMin,
  repsMax: item.unit === '秒' ? item.timerSeconds ?? item.repsMax : item.repsMax,
  unit: item.unit,
  perSide: item.perSide,
  restSeconds: item.restSeconds,
  timerSeconds: item.unit === '秒' ? item.timerSeconds ?? item.repsMin : undefined,
  targetRir: item.rir ?? 2,
  targetWeightKg: item.weightKg,
  notes: item.notes,
  steps: ['按自己设定的动作标准完成每一组。', '保持动作稳定，过程中正常呼吸。', '达到目标次数或倒计时结束后完成本组。'],
  tips: ['动作质量优先于完成数量', '如有不适可立即停止或跳过'],
  mistakes: ['为了完成目标而明显借力', '出现关节疼痛后继续训练'],
  painWarning: '出现关节刺痛、锐痛或明显不适时立即停止。',
})

const makeDatabaseExercise = (database: DatabaseExercise, item: PlanExercise): Exercise => ({
  ...makeCustomExercise(item),
  databaseExerciseId: database.id,
  aliases: database.aliases,
  databaseCategory: database.category,
  movementPatterns: database.movementPatterns,
  difficulty: database.difficulty,
  primaryMuscles: database.primaryMuscles,
  secondaryMuscles: database.secondaryMuscles,
  bodyParts: database.bodyParts,
  effects: database.effects,
  regressions: database.regressions,
  progressions: database.progressions,
  steps: database.steps,
  tips: database.cues,
  mistakes: database.commonMistakes,
  painWarning: database.safetyNotes.join('；'),
  tempo: database.defaultPrescription.tempo ?? undefined,
})

export const estimatePlanMinutes = (exercises: PlanExercise[]) => {
  const seconds = exercises.reduce((total, item) => {
    const activePerSet = item.unit === '秒' ? item.timerSeconds ?? item.repsMin : Math.max(25, item.repsMax * 3)
    return total + item.sets * activePerSet + Math.max(0, item.sets - 1) * item.restSeconds
  }, 0)
  return Math.max(5, Math.ceil(seconds / 300) * 5)
}

export const movePlanExercise = (exercises: PlanExercise[], from: number, to: number) => {
  if (from < 0 || from >= exercises.length || to < 0 || to >= exercises.length || from === to) return exercises
  const next = exercises.map((item) => ({ ...item }))
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next.map((item, order) => ({ ...item, order }))
}

export const replacePlanExerciseFromDatabase = (current: PlanExercise, database: DatabaseExercise): PlanExercise => {
  const replacement = createPlanExerciseFromDatabase(database, current.id)
  return {
    ...replacement,
    sourceExerciseId: current.sourceExerciseId,
    sets: current.sets,
    repsMin: current.repsMin,
    repsMax: current.repsMax,
    unit: current.unit,
    perSide: current.perSide,
    restSeconds: current.restSeconds,
    timerSeconds: current.unit === '秒' ? current.timerSeconds ?? current.repsMin : undefined,
    weightKg: current.weightKg,
    weightMode: current.weightMode,
    rir: current.rir,
    notes: current.notes,
    order: current.order,
  }
}

export const createWorkoutExerciseRecord = (exercise: Exercise, setReduction = 0): WorkoutExerciseRecord => {
  const targetSets = Math.max(1, exercise.sets - setReduction)
  return {
    exerciseId: exercise.id,
    databaseExerciseId: exercise.databaseExerciseId,
    exerciseName: exercise.name,
    nameSnapshot: exercise.name,
    targetSets,
    unit: exercise.unit,
    timerSeconds: exercise.unit === '秒' ? exercise.timerSeconds ?? exercise.repsMin : undefined,
    skipped: false,
    skipReason: '',
    sets: Array.from({ length: targetSets }, (_, index) => ({
      index: index + 1,
      reps: null,
      weightKg: exercise.targetWeightKg ?? null,
      rir: exercise.targetRir ?? 2,
      completed: false,
    })),
  }
}

export const syncWorkoutDraftWithPlan = (draft: WorkoutDraft, plan: TrainingDay) => {
  const existingIds = new Set(draft.exercises.map((exercise) => exercise.exerciseId))
  const setReduction = draft.recoveryAdjustment === 'reduce' ? 1 : 0
  const additions = plan.exercises
    .filter((exercise) => !existingIds.has(exercise.id))
    .map((exercise) => createWorkoutExerciseRecord(exercise, setReduction))
  if (additions.length === 0) return draft
  return { ...draft, exercises: [...draft.exercises, ...additions] }
}

export const resolveTrainingDay = (weeklyPlan: WeeklyPlanDay[], weekday: number): TrainingDay | undefined => {
  const day = weeklyPlan.find((item) => item.weekday === weekday)
  if (!day?.enabled || day.exercises.length === 0) return undefined
  const exercises = day.exercises.map((item) => {
    const source = item.sourceExerciseId ? findExercise(item.sourceExerciseId) : undefined
    const database = findDatabaseExercise(item.exerciseId) ?? findDatabaseExerciseByName(item.nameSnapshot ?? item.name)
    const resolved = database ? makeDatabaseExercise(database, item) : makeCustomExercise(item)
    return source ? { ...resolved, condition: source.condition } : resolved
  })
  const minutes = estimatePlanMinutes(day.exercises)
  return { id: day.id, weekday, title: day.title, focus: day.focus || '自定义训练内容', duration: `约 ${minutes} 分钟`, exercises }
}

export const resolveWeeklyPlanForDate = (
  settings: Pick<AppSettings, 'weekStartsOn' | 'weeklyPlan' | 'weeklyPlanOverrides'>,
  date: string,
) => settings.weeklyPlanOverrides[getWeekStart(date, settings.weekStartsOn)] ?? settings.weeklyPlan

export const resolveTrainingDayForDate = (
  settings: Pick<AppSettings, 'weekStartsOn' | 'weeklyPlan' | 'weeklyPlanOverrides'>,
  date: string,
) => resolveTrainingDay(resolveWeeklyPlanForDate(settings, date), new Date(`${date}T00:00:00`).getDay())
