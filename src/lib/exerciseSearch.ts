import type { DatabaseExercise, ExerciseDifficulty } from '../data/exerciseDatabase'

export interface ExerciseSearchFilters {
  bodyPart?: string
  category?: string
  equipment?: string
  difficulty?: ExerciseDifficulty
  movementPattern?: string
  favoritesOnly?: boolean
  favoriteIds?: string[]
}

type SearchIndex = {
  all: string
  name: string
  aliases: string[]
  primaryAndBody: string
  tagsAndEffects: string
}

const searchIndexes = new WeakMap<DatabaseExercise, SearchIndex>()

export const normalizeSearchText = (value: string) => value
  .normalize('NFKC')
  .toLocaleLowerCase('zh-CN')
  .replace(/[\s·•・,，、。.!！?？:：;；'"“”‘’()（）\[\]【】{}<>《》\-_/\\]+/g, '')

const normalizeList = (values: string[]) => values.map(normalizeSearchText)

export const buildExerciseSearchText = (exercise: DatabaseExercise) => [
  exercise.name,
  ...exercise.aliases,
  exercise.category,
  ...exercise.movementPatterns,
  ...exercise.equipment,
  exercise.difficulty,
  ...exercise.primaryMuscles,
  ...exercise.secondaryMuscles,
  ...exercise.bodyParts,
  ...exercise.effects,
  ...exercise.tags,
].map(normalizeSearchText).join('|')

const getSearchIndex = (exercise: DatabaseExercise) => {
  const cached = searchIndexes.get(exercise)
  if (cached) return cached
  const index = {
    all: buildExerciseSearchText(exercise),
    name: normalizeSearchText(exercise.name),
    aliases: normalizeList(exercise.aliases),
    primaryAndBody: normalizeList([...exercise.primaryMuscles, ...exercise.bodyParts]).join('|'),
    tagsAndEffects: normalizeList([...exercise.tags, ...exercise.effects]).join('|'),
  }
  searchIndexes.set(exercise, index)
  return index
}

export const tokenizeExerciseQuery = (query: string) => query
  .split(/[\s,，、。;；/]+/)
  .map(normalizeSearchText)
  .filter(Boolean)

export const scoreExerciseMatch = (exercise: DatabaseExercise, tokens: string[]) => {
  if (!tokens.length) return 0
  const index = getSearchIndex(exercise)
  if (!tokens.every((token) => index.all.includes(token))) return -1

  const joined = normalizeSearchText(tokens.join(''))
  let score = index.name === joined ? 10_000 : index.name.startsWith(joined) ? 7_000 : 0
  tokens.forEach((token) => {
    if (index.name === token) score += 1_200
    else if (index.name.startsWith(token)) score += 900
    else if (index.name.includes(token)) score += 700
    if (index.aliases.some((alias) => alias === token)) score += 600
    else if (index.aliases.some((alias) => alias.includes(token))) score += 420
    if (index.primaryAndBody.includes(token)) score += 260
    if (index.tagsAndEffects.includes(token)) score += 120
  })
  return score
}

const includesFilter = (values: string[], filter?: string) => {
  if (!filter) return true
  const token = normalizeSearchText(filter)
  return values.some((value) => normalizeSearchText(value).includes(token))
}

export const matchesExerciseFilters = (
  exercise: DatabaseExercise,
  filters: ExerciseSearchFilters = {},
  favoriteIds = new Set(filters.favoriteIds ?? []),
) => {
  return (!filters.favoritesOnly || favoriteIds.has(exercise.id))
    && (!filters.difficulty || exercise.difficulty === filters.difficulty)
    && (!filters.category || exercise.category === filters.category)
    && includesFilter(exercise.bodyParts, filters.bodyPart)
    && includesFilter(exercise.equipment, filters.equipment)
    && includesFilter(exercise.movementPatterns, filters.movementPattern)
}

export const searchExercises = (exercises: DatabaseExercise[], query = '', filters: ExerciseSearchFilters = {}) => {
  const tokens = tokenizeExerciseQuery(query)
  const favoriteIds = new Set(filters.favoriteIds ?? [])
  return exercises
    .map((exercise, index) => ({ exercise, index, score: scoreExerciseMatch(exercise, tokens) }))
    .filter(({ exercise, score }) => score >= 0 && matchesExerciseFilters(exercise, filters, favoriteIds))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ exercise }) => exercise)
}
