import { describe, expect, it, vi } from 'vitest'
import { lockPortraitOrientation } from '../src/lib/orientation'

describe('portrait orientation lock', () => {
  it('locks to portrait-primary when the browser supports it', async () => {
    const lock = vi.fn().mockResolvedValue(undefined)
    await expect(lockPortraitOrientation({ lock })).resolves.toBe(true)
    expect(lock).toHaveBeenCalledWith('portrait-primary')
  })

  it('falls back safely when locking is unsupported', async () => {
    await expect(lockPortraitOrientation(null)).resolves.toBe(false)
    await expect(lockPortraitOrientation({})).resolves.toBe(false)
  })

  it('falls back safely when the browser rejects the lock request', async () => {
    const lock = vi.fn().mockRejectedValue(new Error('not allowed'))
    await expect(lockPortraitOrientation({ lock })).resolves.toBe(false)
  })
})
