import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { getCountdownCue, playCountdownCue, unlockCountdownAudio } from '../lib/countdownAudio'

const formatCountdown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export function SetCountdown({ seconds, completed, label, onComplete }: { seconds: number; completed: boolean; label: string; onComplete: () => void }) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(false)
  const endAtRef = useRef<number | null>(null)
  const lastCueSecondRef = useRef<number | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    setRemaining(seconds)
    setRunning(false)
    endAtRef.current = null
    lastCueSecondRef.current = null
  }, [seconds])

  useEffect(() => {
    if (!completed) return
    setRunning(false)
    endAtRef.current = null
    lastCueSecondRef.current = null
  }, [completed])

  useEffect(() => {
    if (!running) return
    const tick = () => {
      const next = Math.max(0, Math.ceil(((endAtRef.current ?? Date.now()) - Date.now()) / 1000))
      setRemaining(next)
      playCountdownCue(getCountdownCue(lastCueSecondRef.current, next))
      lastCueSecondRef.current = next
      if (next === 0) {
        setRunning(false)
        endAtRef.current = null
        navigator.vibrate?.([180, 100, 180])
        onCompleteRef.current()
      }
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [running])

  const toggle = () => {
    if (completed) return
    if (running) {
      setRunning(false)
      endAtRef.current = null
      return
    }
    unlockCountdownAudio()
    lastCueSecondRef.current = null
    const next = remaining === 0 ? seconds : remaining
    setRemaining(next)
    endAtRef.current = Date.now() + next * 1000
    setRunning(true)
  }

  const reset = () => {
    setRunning(false)
    endAtRef.current = null
    lastCueSecondRef.current = null
    setRemaining(seconds)
  }

  return <div className={`set-countdown ${running ? 'running' : ''} ${completed ? 'completed' : ''}`}>
    <strong>{formatCountdown(completed ? 0 : remaining)}</strong>
    <button type="button" onClick={toggle} disabled={completed} aria-label={`${label}${running ? '暂停倒计时' : '开始倒计时'}`}><Icon name={running ? 'pause' : 'play'} size={14} /></button>
    <button type="button" onClick={reset} disabled={completed || (remaining === seconds && !running)} aria-label={`${label}重置倒计时`}>重置</button>
  </div>
}
