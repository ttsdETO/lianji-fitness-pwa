export type CountdownCue = 'warning' | 'complete'

export const getCountdownCue = (previousSecond: number | null, remainingSecond: number): CountdownCue | null => {
  if (previousSecond === remainingSecond) return null
  if (remainingSecond === 0) return 'complete'
  if (remainingSecond > 0 && remainingSecond <= 3) return 'warning'
  return null
}

let audioContext: AudioContext | null = null
let audioPrimed = false

const getAudioContext = () => {
  if (typeof window === 'undefined') return null
  if (audioContext && audioContext.state !== 'closed') return audioContext
  const AudioContextConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextConstructor) return null
  audioContext = new AudioContextConstructor()
  audioPrimed = false
  return audioContext
}

const scheduleTone = (context: AudioContext, frequency: number, startAt: number, duration: number, volume: number, type: OscillatorType) => {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startAt)
  gain.gain.setValueAtTime(.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(volume, startAt + .012)
  gain.gain.exponentialRampToValueAtTime(.0001, startAt + duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration + .02)
}

const primeAudio = (context: AudioContext) => {
  if (audioPrimed) return
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  gain.gain.setValueAtTime(.0001, context.currentTime)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + .01)
  audioPrimed = true
}

export const unlockCountdownAudio = () => {
  const context = getAudioContext()
  if (!context) return
  if (context.state === 'suspended') void context.resume().then(() => primeAudio(context)).catch(() => undefined)
  else primeAudio(context)
}

export const playCountdownCue = (cue: CountdownCue | null) => {
  if (!cue) return
  const context = getAudioContext()
  if (!context) return
  const play = () => {
    const startAt = context.currentTime + .01
    if (cue === 'warning') {
      scheduleTone(context, 1046.5, startAt, .09, .055, 'sine')
      return
    }
    scheduleTone(context, 659.25, startAt, .14, .07, 'triangle')
    scheduleTone(context, 987.77, startAt + .16, .22, .085, 'triangle')
  }
  if (context.state === 'suspended') void context.resume().then(play).catch(() => undefined)
  else play()
}
