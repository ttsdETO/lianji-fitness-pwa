export type TrainingDayId = string
export type ExerciseUnit = '次' | '秒'
export type ThemeMode = 'system' | 'light' | 'dark'

export interface ExerciseTutorial {
  platform: 'bilibili'
  videoId: string
  title: string
  creator?: string
  url: string
}

export interface WarmupExercise {
  id: string
  databaseExerciseId: string
  phase: 'warmup' | 'stretch'
  optional?: boolean
  name: string
  dose: string
  purpose: string
  steps: string[]
  tips: string[]
  mistakes: string[]
}

export interface Exercise {
  id: string
  databaseExerciseId?: string
  name: string
  category: '复合' | '辅助' | '核心' | '性能'
  equipment: string
  weight?: string
  sets: number
  repsMin: number
  repsMax: number
  unit: ExerciseUnit
  perSide?: boolean
  restSeconds: number
  timerSeconds?: number
  tempo?: string
  steps: string[]
  tips: string[]
  mistakes: string[]
  painWarning: string
  condition?: string
  aliases?: string[]
  databaseCategory?: string
  movementPatterns?: string[]
  difficulty?: string
  primaryMuscles?: string[]
  secondaryMuscles?: string[]
  bodyParts?: string[]
  effects?: string[]
  regressions?: string[]
  progressions?: string[]
  targetRir?: number
  targetWeightKg?: number
  notes?: string
}

export interface TrainingDay {
  id: TrainingDayId
  weekday: number
  title: string
  focus: string
  duration: string
  exercises: Exercise[]
}

export interface ExerciseOverride {
  sets?: number
  repsMin?: number
  repsMax?: number
  restSeconds?: number
}

export interface PlanExercise {
  id: string
  sourceExerciseId?: string
  exerciseId?: string
  name: string
  nameSnapshot?: string
  category: Exercise['category']
  databaseCategory?: string
  equipment: string
  sets: number
  repsMin: number
  repsMax: number
  unit: ExerciseUnit
  perSide: boolean
  restSeconds: number
  timerSeconds?: number
  weightKg?: number
  weightMode?: 'each' | 'total'
  rir?: number
  notes?: string
  order?: number
  customExercise?: boolean
}

export interface WeeklyPlanDay {
  id: string
  weekday: number
  enabled: boolean
  title: string
  focus: string
  exercises: PlanExercise[]
}

export interface WorkoutSetRecord {
  index: number
  reps: number | null
  weightKg?: number | null
  rir: number | null
  completed: boolean
}

export interface WorkoutExerciseRecord {
  exerciseId: string
  databaseExerciseId?: string
  exerciseName: string
  nameSnapshot?: string
  targetSets: number
  unit: ExerciseUnit
  timerSeconds?: number
  sets: WorkoutSetRecord[]
  skipped: boolean
  skipReason: string
}

export interface WorkoutRecord {
  id: string
  date: string
  performedDate?: string
  isMakeup?: boolean
  planId: TrainingDayId
  planTitle: string
  startedAt: string
  completedAt: string
  durationMinutes: number
  completionRate: number
  recoveryAdjustment: 'none' | 'reduce' | 'rest'
  exercises: WorkoutExerciseRecord[]
  note: string
}

export interface WorkoutDraft extends Omit<WorkoutRecord, 'completedAt' | 'durationMinutes' | 'completionRate'> {
  updatedAt: string
  stopwatchElapsedSeconds?: number
  stopwatchSegmentSeconds?: number
  stopwatchStartedAt?: number | null
  stopwatchRunning?: boolean
}

export interface BodyMeasurements {
  chest?: number
  waist?: number
  hips?: number
  upperArmLeft?: number
  upperArmRight?: number
  thighLeft?: number
  thighRight?: number
  calfLeft?: number
  calfRight?: number
}

export interface BodyRecord extends BodyMeasurements {
  id: string
  date: string
  weight?: number
  note: string
}

export interface RecoveryRecord {
  id: string
  date: string
  sleepHours: number
  bedtimeMinutes?: number
  wakeTimeMinutes?: number
  fatigue: number
  soreness: number
  jointPain: boolean
  painArea: string
  note: string
}

export interface Profile extends BodyMeasurements {
  name: string
  birthDate: string
  height?: number
  baselineWeight?: number
  goalWeight?: number
  proteinMin?: number
  proteinMax?: number
  equipment: string[]
}

export interface AppSettings {
  theme: ThemeMode
  weekStartsOn: 0 | 1
  exerciseOverrides: Record<string, ExerciseOverride>
  weeklyPlan: WeeklyPlanDay[]
  weeklyPlanOverrides: Record<string, WeeklyPlanDay[]>
  favoriteExerciseIds: string[]
  recentExerciseIds: string[]
  exerciseTutorials: Record<string, ExerciseTutorial | null>
}

export interface AppData {
  schemaVersion: 3
  profile: Profile
  settings: AppSettings
  workouts: WorkoutRecord[]
  bodyRecords: BodyRecord[]
  recoveryRecords: RecoveryRecord[]
  workoutDrafts: Record<string, WorkoutDraft>
}

export interface RecoveryAdvice {
  level: 'normal' | 'reduce' | 'rest' | 'pain'
  title: string
  message: string
}
