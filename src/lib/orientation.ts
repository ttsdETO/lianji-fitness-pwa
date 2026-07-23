export interface OrientationLockTarget {
  lock?: (orientation: 'portrait-primary') => Promise<void>
}

export async function lockPortraitOrientation(target?: OrientationLockTarget | null) {
  const orientation = target === undefined
    ? (typeof screen === 'undefined' ? null : screen.orientation as OrientationLockTarget)
    : target
  if (!orientation?.lock) return false
  try {
    await orientation.lock('portrait-primary')
    return true
  } catch {
    return false
  }
}
