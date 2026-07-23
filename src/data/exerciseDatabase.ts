import rawDatabase from './exercise-database.zh-CN.json'

export type ExerciseDifficulty = '入门' | '初级' | '中级' | '高级'

export interface ExercisePrescription {
  sets: number
  reps: string
  restSeconds: number
  rir: number
  tempo: string | null
}

export interface DatabaseExercise {
  id: string
  name: string
  aliases: string[]
  category: string
  movementPatterns: string[]
  equipment: string[]
  difficulty: ExerciseDifficulty
  unilateral: boolean
  primaryMuscles: string[]
  secondaryMuscles: string[]
  bodyParts: string[]
  effects: string[]
  steps: string[]
  cues: string[]
  commonMistakes: string[]
  safetyNotes: string[]
  defaultPrescription: ExercisePrescription
  tags: string[]
  regressions: string[]
  progressions: string[]
}

export interface ExerciseDatabase {
  version: string
  locale: 'zh-CN'
  scope: string
  disclaimer: string[]
  searchableFields: string[]
  exercises: DatabaseExercise[]
}

export const exerciseDatabase = rawDatabase as unknown as ExerciseDatabase
export const databaseExercises = exerciseDatabase.exercises

const exercisesById = new Map(databaseExercises.map((exercise) => [exercise.id, exercise]))
const normalizeName = (value: string) => value.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[\s·•・,，、()（）\-_/]+/g, '')
const exercisesByName = new Map<string, DatabaseExercise>()

databaseExercises.forEach((exercise) => {
  exercisesByName.set(normalizeName(exercise.name), exercise)
  exercise.aliases.forEach((alias) => exercisesByName.set(normalizeName(alias), exercise))
})

export const findDatabaseExercise = (id?: string) => id ? exercisesById.get(id) : undefined
export const findDatabaseExerciseByName = (name?: string) => name ? exercisesByName.get(normalizeName(name)) : undefined

const simplifyExerciseName = (value: string) => normalizeName(value)
  .replace(/第\d+周起可选/g, '')
  .replace(/标准|严格|慢速|徒手|负重|双哑铃|单哑铃|哑铃|扶墙|原地|我的|自定义|训练|动作/g, '')

const bigrams = (value: string) => value.length < 2 ? [value] : Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2))

const nameSimilarity = (source: string, target: string) => {
  if (!source || !target) return 0
  if (source === target) return 100
  let score = 0
  if ((source.includes(target) || target.includes(source)) && Math.min(source.length, target.length) >= 2) score += 58 + Math.min(source.length, target.length) / Math.max(source.length, target.length) * 18
  const sourcePairs = bigrams(source)
  const targetPairs = [...bigrams(target)]
  let overlap = 0
  sourcePairs.forEach((pair) => {
    const index = targetPairs.indexOf(pair)
    if (index >= 0) {
      overlap += 1
      targetPairs.splice(index, 1)
    }
  })
  score += (2 * overlap / Math.max(1, sourcePairs.length + bigrams(target).length)) * 34
  const sourceChars = new Set(source)
  const targetChars = new Set(target)
  const commonChars = [...sourceChars].filter((char) => targetChars.has(char)).length
  score += commonChars / Math.max(1, new Set([...sourceChars, ...targetChars]).size) * 16
  return score
}

export const findClosestDatabaseExercise = (input: { name?: string; equipment?: string; category?: string }): DatabaseExercise => {
  const exact = findDatabaseExerciseByName(input.name)
  if (exact) return exact
  const sourceName = simplifyExerciseName(input.name ?? '')
  const sourceEquipment = normalizeName(input.equipment ?? '')
  return databaseExercises
    .map((exercise, index) => {
      const names = [exercise.name, ...exercise.aliases].map(simplifyExerciseName)
      let score = Math.max(...names.map((name) => nameSimilarity(sourceName, name)))
      if (sourceEquipment && exercise.equipment.some((item) => sourceEquipment.includes(normalizeName(item)) || normalizeName(item).includes(sourceEquipment))) score += 12
      if (input.category === '核心' && exercise.category === '核心') score += 9
      if (input.category === '性能' && exercise.category === '心肺与爆发') score += 9
      if (input.category === '复合' && ['上肢推', '上肢拉', '下肢'].includes(exercise.category)) score += 5
      return { exercise, index, score }
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)[0].exercise
}

export default exerciseDatabase
