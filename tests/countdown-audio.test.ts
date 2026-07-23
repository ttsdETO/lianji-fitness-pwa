import { describe, expect, it } from 'vitest'
import { getCountdownCue } from '../src/lib/countdownAudio'

describe('倒计时声音提示', () => {
  it('只在最后3秒和归零时返回声音提示', () => {
    expect(getCountdownCue(null, 10)).toBeNull()
    expect(getCountdownCue(4, 3)).toBe('warning')
    expect(getCountdownCue(3, 2)).toBe('warning')
    expect(getCountdownCue(2, 1)).toBe('warning')
    expect(getCountdownCue(1, 0)).toBe('complete')
  })

  it('同一秒的高频刷新不会重复播放', () => {
    expect(getCountdownCue(3, 3)).toBeNull()
    expect(getCountdownCue(0, 0)).toBeNull()
  })
})
