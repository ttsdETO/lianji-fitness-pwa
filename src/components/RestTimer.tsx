import { Icon } from './Icon'

export interface RestTimerState {
  duration: number
  remaining: number
  running: boolean
  exerciseName: string
}

interface Props {
  timer: RestTimerState | null
  onToggle: () => void
  onAdd: (seconds: number) => void
  onFinish: () => void
}

export function RestTimer({ timer, onToggle, onAdd, onFinish }: Props) {
  if (!timer) return null
  const minutes = Math.floor(timer.remaining / 60)
  const seconds = timer.remaining % 60
  const progress = timer.duration ? Math.max(0, timer.remaining / timer.duration) : 0
  return <aside className={`rest-timer ${timer.remaining === 0 ? 'finished' : ''}`} style={{ '--timer-progress': `${progress * 100}%` } as React.CSSProperties}>
    <button className="timer-main" onClick={onToggle} aria-label={timer.running ? '暂停计时' : '继续计时'}>
      <span className="timer-icon"><Icon name={timer.running ? 'pause' : 'play'} size={18} /></span>
      <span><small>{timer.remaining === 0 ? '休息结束' : `${timer.exerciseName} · 组间休息`}</small><strong>{minutes}:{String(seconds).padStart(2, '0')}</strong></span>
    </button>
    <button className="timer-add" onClick={() => onAdd(30)}>+30 秒</button>
    <button className="timer-skip" onClick={onFinish}>结束</button>
  </aside>
}
