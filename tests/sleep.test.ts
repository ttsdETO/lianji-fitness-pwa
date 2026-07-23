import { describe, expect, it } from 'vitest'
import { formatClockTime, formatSleepDuration, getSleepDurationMinutes, normalizeClockMinutes } from '../src/components/SleepDurationDial'

describe('入睡与起床双端点环形选择器', () => {
  it('把时间吸附到 5 分钟刻度并在一天内循环', () => {
    expect(normalizeClockMinutes(422)).toBe(420)
    expect(normalizeClockMinutes(423)).toBe(425)
    expect(normalizeClockMinutes(-8)).toBe(1430)
    expect(normalizeClockMinutes(1443)).toBe(5)
  })

  it('跨过午夜自动计算睡眠时长', () => {
    expect(getSleepDurationMinutes(23 * 60, 6 * 60)).toBe(420)
    expect(getSleepDurationMinutes(23 * 60 + 10, 7 * 60 + 30)).toBe(500)
    expect(formatClockTime(23 * 60 + 10)).toBe('23:10')
    expect(formatClockTime(7 * 60 + 30)).toBe('07:30')
  })

  it('以小时和分钟显示自动计算结果', () => {
    expect(formatSleepDuration(7)).toBe('7 小时')
    expect(formatSleepDuration(7 + 5 / 60)).toBe('7 小时 5 分钟')
  })
})
