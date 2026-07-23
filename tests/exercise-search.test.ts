import { describe, expect, it } from 'vitest'
import { databaseExercises } from '../src/data/exerciseDatabase'
import { buildExerciseSearchText, searchExercises } from '../src/lib/exerciseSearch'

describe('训练动作数据库搜索', () => {
  it('数据库 id 唯一且进阶、退阶引用都有效', () => {
    const ids = databaseExercises.map((exercise) => exercise.id)
    const idSet = new Set(ids)
    expect(databaseExercises).toHaveLength(93)
    expect(idSet.size).toBe(ids.length)
    databaseExercises.forEach((exercise) => {
      exercise.regressions.forEach((id) => expect(idSet.has(id), `${exercise.id} 的退阶 ${id} 不存在`).toBe(true))
      exercise.progressions.forEach((id) => expect(idSet.has(id), `${exercise.id} 的进阶 ${id} 不存在`).toBe(true))
    })
  })

  it('支持中文动作名、别名和主要肌群搜索', () => {
    expect(searchExercises(databaseExercises, '墙面俯卧撑')[0].id).toBe('wall-push-up')
    expect(searchExercises(databaseExercises, '站姿俯卧撑')[0].id).toBe('wall-push-up')
    expect(searchExercises(databaseExercises, '胸大肌').some((exercise) => exercise.id === 'wall-push-up')).toBe(true)
  })

  it('多关键词使用 AND 逻辑并忽略常见符号', () => {
    const results = searchExercises(databaseExercises, '肩，哑铃')
    expect(results.length).toBeGreaterThan(0)
    results.forEach((exercise) => {
      const text = buildExerciseSearchText(exercise)
      expect(text).toContain('肩')
      expect(text).toContain('哑铃')
    })
    expect(searchExercises(databaseExercises, '腹 单杠').some((exercise) => exercise.name.includes('悬垂'))).toBe(true)
  })

  it('器械、难度与收藏筛选可组合', () => {
    const results = searchExercises(databaseExercises, '', { equipment: '哑铃', difficulty: '入门' })
    expect(results.length).toBeGreaterThan(0)
    results.forEach((exercise) => {
      expect(exercise.difficulty).toBe('入门')
      expect(exercise.equipment.join('')).toContain('哑铃')
    })
    expect(searchExercises(databaseExercises, '', { favoritesOnly: true, favoriteIds: ['wall-push-up'] }).map((item) => item.id)).toEqual(['wall-push-up'])
  })

  it('完全匹配优先且空白搜索返回默认列表', () => {
    const exact = searchExercises(databaseExercises, '墙面俯卧撑')
    expect(exact[0].name).toBe('墙面俯卧撑')
    expect(searchExercises(databaseExercises, '')).toEqual(databaseExercises)
  })
})
