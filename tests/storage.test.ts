import { describe, expect, it } from 'vitest'
import { createDefaultData, exportBackup, getWorkoutHistoryDate, importBackup, loadAppData, saveAppData, STORAGE_KEY, upsertWorkout } from '../src/lib/storage'
import type { WorkoutRecord } from '../src/types'

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const workout: WorkoutRecord = {
  id: '2026-07-21_lower-a', date: '2026-07-21', planId: 'lower-a', planTitle: '下肢 A',
  startedAt: '2026-07-21T10:00:00.000Z', completedAt: '2026-07-21T10:48:00.000Z', durationMinutes: 48,
  completionRate: 100, recoveryAdjustment: 'none', note: '',
  exercises: [{
    exerciseId: 'front-squat', exerciseName: '双哑铃前蹲', targetSets: 3, unit: '次', skipped: false, skipReason: '',
    sets: [
      { index: 1, reps: 15, rir: 2, completed: true },
      { index: 2, reps: 15, rir: 2, completed: true },
      { index: 3, reps: 14, rir: 2, completed: true },
    ],
  }],
}

describe('本地训练记录', () => {
  it('默认资料不包含生日、身体指标、目标或器械', () => {
    const data = createDefaultData()
    expect(data.profile).toEqual({ name: '训练者', birthDate: '', equipment: [] })
  })

  it('保存后可以从本地存储完整读回训练记录', () => {
    const storage = new MemoryStorage()
    const data = upsertWorkout(createDefaultData(), workout)
    saveAppData(data, storage)
    expect(storage.getItem(STORAGE_KEY)).toContain('双哑铃前蹲')
    const loaded = loadAppData(storage)
    expect(loaded.workouts).toHaveLength(1)
    expect(loaded.workouts[0].exercises[0].sets[2]).toMatchObject({ reps: 14, rir: 2, completed: true })
  })

  it('补练记录按真实完成时间排序并使用完成日期显示', () => {
    const olderScheduledWorkout = { ...workout, id: 'regular-later', date: '2026-07-21', completedAt: '2026-07-21T10:48:00.000Z' }
    const makeup = {
      ...workout,
      id: 'makeup-latest',
      date: '2026-07-14',
      performedDate: '2026-07-22',
      isMakeup: true,
      planTitle: '补练 · 下肢 A',
      completedAt: '2026-07-22T12:30:00.000Z',
    }
    const data = upsertWorkout(upsertWorkout(createDefaultData(), olderScheduledWorkout), makeup)
    expect(data.workouts.map((item) => item.id)).toEqual(['makeup-latest', 'regular-later'])
    expect(getWorkoutHistoryDate(data.workouts[0])).toBe('2026-07-22')
  })

  it('JSON 备份可以往返导入且拒绝无效结构', () => {
    const data = upsertWorkout(createDefaultData(), workout)
    expect(importBackup(exportBackup(data)).workouts[0].id).toBe(workout.id)
    expect(() => importBackup('{"hello":"world"}')).toThrow('不是有效')
  })

  it('旧版数据缺少七日计划时会自动迁移且保留记录', () => {
    const storage = new MemoryStorage()
    const legacy = upsertWorkout(createDefaultData(), workout)
    delete (legacy.settings as Partial<typeof legacy.settings>).weeklyPlan
    storage.setItem(STORAGE_KEY, JSON.stringify(legacy))
    const loaded = loadAppData(storage)
    expect(loaded.settings.weeklyPlan).toHaveLength(7)
    expect(loaded.settings.weeklyPlan.filter((day) => day.enabled)).toHaveLength(4)
    expect(loaded.workouts[0].id).toBe(workout.id)
  })

  it('JSON 备份包含自定义计划、收藏、最近使用和历史记录', () => {
    const data = upsertWorkout(createDefaultData(), workout)
    data.settings.favoriteExerciseIds = ['wall-push-up']
    data.settings.recentExerciseIds = ['wall-push-up', 'goblet-squat']
    data.settings.weeklyPlan[0].exercises[0].notes = '肩胛保持下沉'
    const imported = importBackup(exportBackup(data))
    expect(imported.schemaVersion).toBe(3)
    expect(imported.settings.favoriteExerciseIds).toEqual(['wall-push-up'])
    expect(imported.settings.recentExerciseIds).toEqual(['wall-push-up', 'goblet-squat'])
    expect(imported.settings.weeklyPlan[0].exercises[0].notes).toBe('肩胛保持下沉')
    expect(imported.workouts[0].exercises[0].nameSnapshot).toBe('双哑铃前蹲')
  })

  it('升级到新版时自动填充数据库教程且不改动历史、身体和草稿数据', () => {
    const storage = new MemoryStorage()
    const legacy = upsertWorkout(createDefaultData(), workout)
    legacy.bodyRecords.push({ id: 'body-1', date: '2026-07-20', weight: 56.2, note: '保留' })
    delete (legacy.settings as Partial<typeof legacy.settings>).exerciseTutorials
    ;(legacy as { schemaVersion: number }).schemaVersion = 2
    storage.setItem(STORAGE_KEY, JSON.stringify(legacy))
    const loaded = loadAppData(storage)
    expect(loaded.schemaVersion).toBe(3)
    expect(loaded.settings.exerciseTutorials['dumbbell-front-squat']?.videoId).toBe('BV1X2421P7TL')
    expect(loaded.workouts[0].exercises[0].sets[2]).toMatchObject({ reps: 14, completed: true })
    expect(loaded.bodyRecords[0]).toMatchObject({ id: 'body-1', weight: 56.2, note: '保留' })
  })
})
