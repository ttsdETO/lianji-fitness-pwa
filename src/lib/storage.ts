import { cloneDefaultExerciseTutorials } from '../data/exerciseTutorials'
import type { AppData, AppSettings, BodyRecord, ExerciseTutorial, Profile, RecoveryRecord, WorkoutDraft, WorkoutRecord } from '../types'
import { createDefaultWeeklyPlan, normalizeWeeklyPlan } from './plan'
import { toLocalISODate } from './date'

export const STORAGE_KEY = 'lianji-app-data-v1'

export const defaultProfile: Profile = {
  name: '训练者',
  birthDate: '',
  equipment: [],
}

export const createDefaultData = (): AppData => ({
  schemaVersion: 3,
  profile: { ...defaultProfile, equipment: [...defaultProfile.equipment] },
  settings: {
    theme: 'system',
    weekStartsOn: 1,
    exerciseOverrides: {},
    weeklyPlan: createDefaultWeeklyPlan(),
    weeklyPlanOverrides: {},
    favoriteExerciseIds: [],
    recentExerciseIds: [],
    exerciseTutorials: cloneDefaultExerciseTutorials(),
  },
  workouts: [],
  bodyRecords: [],
  recoveryRecords: [],
  workoutDrafts: {},
})

type StoredAppData = Omit<AppData, 'schemaVersion'> & { schemaVersion: 1 | 2 | 3 }

const isAppData = (value: unknown): value is StoredAppData => {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<StoredAppData>
  return (data.schemaVersion === 1 || data.schemaVersion === 2 || data.schemaVersion === 3) && !!data.profile && !!data.settings && Array.isArray(data.workouts) && Array.isArray(data.bodyRecords) && Array.isArray(data.recoveryRecords)
}

const migrateWorkoutExercises = (exercises: WorkoutRecord['exercises']) => exercises.map((exercise) => ({
  ...exercise,
  nameSnapshot: exercise.nameSnapshot ?? exercise.exerciseName,
  sets: exercise.sets.map((set) => ({ ...set, weightKg: set.weightKg ?? null })),
}))

const normalizeExerciseTutorials = (value: unknown): Record<string, ExerciseTutorial | null> => {
  if (!value || typeof value !== 'object') return {}
  const tutorials: Record<string, ExerciseTutorial | null> = {}
  Object.entries(value).forEach(([exerciseId, raw]) => {
    if (raw === null) {
      tutorials[exerciseId] = null
      return
    }
    if (!raw || typeof raw !== 'object') return
    const tutorial = raw as Partial<ExerciseTutorial>
    if (tutorial.platform !== 'bilibili' || typeof tutorial.videoId !== 'string' || typeof tutorial.title !== 'string' || typeof tutorial.url !== 'string') return
    tutorials[exerciseId] = {
      platform: 'bilibili',
      videoId: tutorial.videoId,
      title: tutorial.title,
      creator: typeof tutorial.creator === 'string' ? tutorial.creator : undefined,
      url: tutorial.url,
    }
  })
  return tutorials
}

const normalizeWeeklyPlanOverrides = (value: unknown, exerciseOverrides: AppSettings['exerciseOverrides']) => {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value).flatMap(([weekStart, plan]) => (
    /^\d{4}-\d{2}-\d{2}$/.test(weekStart) && Array.isArray(plan)
      ? [[weekStart, normalizeWeeklyPlan(plan, exerciseOverrides)]]
      : []
  )))
}

const getWorkoutCompletionTimestamp = (workout: WorkoutRecord) => {
  const completedAt = new Date(workout.completedAt).getTime()
  if (Number.isFinite(completedAt)) return completedAt
  return new Date(`${workout.performedDate ?? workout.date}T23:59:59`).getTime()
}

export const sortWorkoutsByCompletion = (workouts: WorkoutRecord[]) => [...workouts].sort((a, b) => (
  getWorkoutCompletionTimestamp(b) - getWorkoutCompletionTimestamp(a)
))

export const getWorkoutHistoryDate = (workout: WorkoutRecord) => {
  const completedAt = new Date(workout.completedAt)
  return Number.isNaN(completedAt.getTime()) ? workout.performedDate ?? workout.date : toLocalISODate(completedAt)
}

const mergeWithDefaults = (data: StoredAppData): AppData => {
  const defaults = createDefaultData()
  const exerciseOverrides = data.settings.exerciseOverrides ?? {}
  return {
    ...defaults,
    ...data,
    schemaVersion: 3,
    profile: { ...defaults.profile, ...data.profile, equipment: data.profile.equipment ?? defaults.profile.equipment },
    settings: {
      ...defaults.settings,
      ...data.settings,
      exerciseOverrides,
      weeklyPlan: normalizeWeeklyPlan(data.settings.weeklyPlan, exerciseOverrides),
      weeklyPlanOverrides: normalizeWeeklyPlanOverrides((data.settings as Partial<AppSettings>).weeklyPlanOverrides, exerciseOverrides),
      favoriteExerciseIds: Array.isArray(data.settings.favoriteExerciseIds) ? data.settings.favoriteExerciseIds.filter((id): id is string => typeof id === 'string') : [],
      recentExerciseIds: Array.isArray(data.settings.recentExerciseIds) ? data.settings.recentExerciseIds.filter((id): id is string => typeof id === 'string').slice(0, 16) : [],
      exerciseTutorials: {
        ...defaults.settings.exerciseTutorials,
        ...normalizeExerciseTutorials((data.settings as Partial<AppSettings>).exerciseTutorials),
      },
    },
    workouts: sortWorkoutsByCompletion(data.workouts.map((workout) => ({ ...workout, exercises: migrateWorkoutExercises(workout.exercises) }))),
    workoutDrafts: Object.fromEntries(Object.entries(data.workoutDrafts ?? {}).map(([date, draft]) => [date, { ...draft, exercises: migrateWorkoutExercises(draft.exercises) }])),
  }
}

export const loadAppData = (storage: Pick<Storage, 'getItem'> = localStorage): AppData => {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultData()
    const parsed: unknown = JSON.parse(raw)
    return isAppData(parsed) ? mergeWithDefaults(parsed) : createDefaultData()
  } catch {
    return createDefaultData()
  }
}

export const saveAppData = (data: AppData, storage: Pick<Storage, 'setItem'> = localStorage) => {
  storage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export const upsertWorkout = (data: AppData, record: WorkoutRecord): AppData => ({
  ...data,
  workouts: sortWorkoutsByCompletion([record, ...data.workouts.filter((item) => item.id !== record.id)]),
  workoutDrafts: Object.fromEntries(Object.entries(data.workoutDrafts).filter(([, draft]) => draft.id !== record.id)),
})

export const upsertBodyRecord = (data: AppData, record: BodyRecord): AppData => ({
  ...data,
  bodyRecords: [record, ...data.bodyRecords.filter((item) => item.id !== record.id)].sort((a, b) => b.date.localeCompare(a.date)),
})

export const upsertRecoveryRecord = (data: AppData, record: RecoveryRecord): AppData => ({
  ...data,
  recoveryRecords: [record, ...data.recoveryRecords.filter((item) => item.id !== record.id)].sort((a, b) => b.date.localeCompare(a.date)),
})

export const upsertDraft = (data: AppData, draft: WorkoutDraft): AppData => ({
  ...data,
  workoutDrafts: { ...data.workoutDrafts, [draft.date]: draft },
})

export const exportBackup = (data: AppData) => JSON.stringify({
  app: '练迹 · 本地健身记录',
  exportedAt: new Date().toISOString(),
  data,
}, null, 2)

export const importBackup = (raw: string): AppData => {
  const parsed: unknown = JSON.parse(raw)
  const candidate = parsed && typeof parsed === 'object' && 'data' in parsed ? (parsed as { data: unknown }).data : parsed
  if (!isAppData(candidate)) throw new Error('这不是有效的练迹备份文件')
  return mergeWithDefaults(candidate)
}
