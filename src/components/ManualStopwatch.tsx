import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon'

interface StopwatchValue {
  elapsedSeconds?: number
  segmentSeconds?: number
  startedAt?: number | null
  running?: boolean
}

interface Props extends StopwatchValue {
  onChange: (value: Required<StopwatchValue>) => void
}

const getTotalSeconds = ({ elapsedSeconds = 0, startedAt, running }: StopwatchValue, now = Date.now()) =>
  elapsedSeconds + (running && startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0)

const formatTime = (total: number) => {
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function ManualStopwatch({ elapsedSeconds = 0, segmentSeconds = 0, startedAt = null, running = false, onChange }: Props) {
  const [now, setNow] = useState(Date.now())
  const currentSegment = running && startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : segmentSeconds
  const total = useMemo(() => getTotalSeconds({ elapsedSeconds, startedAt, running }, now), [elapsedSeconds, startedAt, running, now])

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [running])

  const toggle = () => {
    if (running) {
      const completedSegment = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0
      onChange({ elapsedSeconds: elapsedSeconds + completedSegment, segmentSeconds: completedSegment, startedAt: null, running: false })
    } else {
      onChange({ elapsedSeconds, segmentSeconds: 0, startedAt: Date.now(), running: true })
      setNow(Date.now())
    }
  }

  return <section className={`manual-stopwatch ${running ? 'running' : ''}`} aria-label="手动训练计时器">
    <div className="stopwatch-label"><span><Icon name="timer" size={18} /></span><div><small>总时长</small><strong>{formatTime(total)}</strong></div></div>
    <div className="stopwatch-segment"><small>{running ? '本次启动' : '上次启动'}</small><strong>{formatTime(currentSegment)}</strong></div>
    <div className="stopwatch-actions">
      <button className="stopwatch-toggle" onClick={toggle}><Icon name={running ? 'pause' : 'play'} size={17} />{running ? '暂停' : total > 0 ? '继续' : '开始秒表'}</button>
      <button className="stopwatch-reset" disabled={total === 0} onClick={() => onChange({ elapsedSeconds: 0, segmentSeconds: 0, startedAt: null, running: false })}>重置</button>
    </div>
  </section>
}
