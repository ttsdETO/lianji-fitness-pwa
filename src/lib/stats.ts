import { getWeekStart, parseLocalDate } from './date'
import type { BodyRecord, WorkoutRecord } from '../types'

export const getWeeklyWeightAverages = (records: BodyRecord[], weekStartsOn: 0 | 1) => {
  const groups = new Map<string, number[]>()
  records.filter((item) => typeof item.weight === 'number').forEach((item) => {
    const key = getWeekStart(item.date, weekStartsOn)
    groups.set(key, [...(groups.get(key) ?? []), item.weight as number])
  })
  return [...groups.entries()]
    .map(([week, values]) => ({ week, average: values.reduce((sum, value) => sum + value, 0) / values.length, count: values.length }))
    .sort((a, b) => a.week.localeCompare(b.week))
}

export const getWorkoutStreak = (records: WorkoutRecord[]) => {
  if (!records.length) return 0
  const uniqueWeeks = [...new Set(records.map((item) => getWeekStart(item.date, 1)))].sort().reverse()
  let streak = 1
  for (let index = 1; index < uniqueWeeks.length; index += 1) {
    const previous = parseLocalDate(uniqueWeeks[index - 1])
    const current = parseLocalDate(uniqueWeeks[index])
    const difference = Math.round((previous.getTime() - current.getTime()) / 86_400_000)
    if (difference === 7) streak += 1
    else break
  }
  return streak
}

const trendGroups = [
  { key: '引体向上', label: '引体向上', ids: ['strict-pull-up-a', 'strict-pull-up-b'] },
  { key: '俯卧撑', label: '俯卧撑', ids: ['incline-push-up', 'pike-push-up', 'eccentric-push-up'] },
  { key: '深蹲', label: '深蹲', ids: ['front-squat', 'goblet-squat', 'split-squat-a', 'split-squat-b'] },
]

export const getExerciseTrends = (records: WorkoutRecord[]) => trendGroups.map((group) => {
  const points = records
    .flatMap((workout) => workout.exercises
      .filter((item) => group.ids.includes(item.exerciseId) && !item.skipped)
      .map((item) => ({
        date: workout.date,
        value: Math.max(0, ...item.sets.filter((set) => set.completed).map((set) => set.reps ?? 0)),
      })))
    .filter((point) => point.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8)
  return { ...group, points }
})
