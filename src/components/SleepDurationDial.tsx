import { useRef } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import { Icon } from './Icon'

const STEP_MINUTES = 5
const DAY_MINUTES = 24 * 60
const CLOCK_TICKS = Array.from({ length: 96 }, (_, index) => index)
const CLOCK_LABELS = Array.from({ length: 8 }, (_, index) => index * 3)

type SleepHandle = 'bedtime' | 'wakeTime'

export interface SleepScheduleChange {
  bedtimeMinutes: number
  wakeTimeMinutes: number
  sleepHours: number
}

export const normalizeClockMinutes = (minutes: number) => {
  const snapped = Math.round(minutes / STEP_MINUTES) * STEP_MINUTES
  return ((snapped % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
}

export const formatClockTime = (minutes: number) => {
  const normalized = normalizeClockMinutes(minutes)
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`
}

export const getSleepDurationMinutes = (bedtimeMinutes: number, wakeTimeMinutes: number) => {
  return (normalizeClockMinutes(wakeTimeMinutes) - normalizeClockMinutes(bedtimeMinutes) + DAY_MINUTES) % DAY_MINUTES
}

export const formatSleepDuration = (hoursValue: number) => {
  const total = Math.max(0, Math.round(hoursValue * 60 / STEP_MINUTES) * STEP_MINUTES)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return minutes ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`
}

const circularDistance = (first: number, second: number) => {
  const distance = Math.abs(first - second)
  return Math.min(distance, DAY_MINUTES - distance)
}

const clockPoint = (hour: number, radius: number) => {
  const angle = hour / 24 * Math.PI * 2 - Math.PI / 2
  return { x: 120 + Math.cos(angle) * radius, y: 120 + Math.sin(angle) * radius }
}

interface Props {
  bedtimeMinutes: number
  wakeTimeMinutes: number
  onChange: (value: SleepScheduleChange) => void
}

export function SleepDurationDial({ bedtimeMinutes, wakeTimeMinutes, onChange }: Props) {
  const dialRef = useRef<HTMLDivElement>(null)
  const activeHandleRef = useRef<SleepHandle | null>(null)
  const bedtime = normalizeClockMinutes(bedtimeMinutes)
  const wakeTime = normalizeClockMinutes(wakeTimeMinutes)
  const duration = getSleepDurationMinutes(bedtime, wakeTime)
  const bedtimeAngle = bedtime / DAY_MINUTES * 360
  const wakeTimeAngle = wakeTime / DAY_MINUTES * 360
  const durationAngle = duration / DAY_MINUTES * 360

  const commit = (nextBedtime: number, nextWakeTime: number) => {
    const normalizedBedtime = normalizeClockMinutes(nextBedtime)
    const normalizedWakeTime = normalizeClockMinutes(nextWakeTime)
    onChange({
      bedtimeMinutes: normalizedBedtime,
      wakeTimeMinutes: normalizedWakeTime,
      sleepHours: getSleepDurationMinutes(normalizedBedtime, normalizedWakeTime) / 60,
    })
  }

  const setHandle = (handle: SleepHandle, minutes: number) => {
    if (handle === 'bedtime') commit(minutes, wakeTime)
    else commit(bedtime, minutes)
  }

  const getPointerMinutes = (clientX: number, clientY: number) => {
    const rect = dialRef.current?.getBoundingClientRect()
    if (!rect) return null
    const x = clientX - (rect.left + rect.width / 2)
    const y = clientY - (rect.top + rect.height / 2)
    const degrees = (Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360
    return normalizeClockMinutes(degrees / 360 * DAY_MINUTES)
  }

  const updateFromPointer = (handle: SleepHandle, clientX: number, clientY: number) => {
    const minutes = getPointerMinutes(clientX, clientY)
    if (minutes !== null) setHandle(handle, minutes)
  }

  const beginHandleDrag = (handle: SleepHandle, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    activeHandleRef.current = handle
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveHandle = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !activeHandleRef.current) return
    updateFromPointer(activeHandleRef.current, event.clientX, event.clientY)
  }

  const finishDrag = () => { activeHandleRef.current = null }

  const handleRingPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const rect = dialRef.current?.getBoundingClientRect()
    const minutes = getPointerMinutes(event.clientX, event.clientY)
    if (!rect || minutes === null) return
    const distanceFromCenter = Math.hypot(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2))
    if (distanceFromCenter < rect.width * .28) return
    const handle = circularDistance(minutes, bedtime) <= circularDistance(minutes, wakeTime) ? 'bedtime' : 'wakeTime'
    activeHandleRef.current = handle
    event.currentTarget.setPointerCapture(event.pointerId)
    setHandle(handle, minutes)
  }

  const handleRingPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !activeHandleRef.current) return
    updateFromPointer(activeHandleRef.current, event.clientX, event.clientY)
  }

  const handleKeyDown = (handle: SleepHandle, currentMinutes: number, event: KeyboardEvent<HTMLButtonElement>) => {
    let delta = 0
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') delta = STEP_MINUTES
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') delta = -STEP_MINUTES
    if (event.key === 'PageUp') delta = 30
    if (event.key === 'PageDown') delta = -30
    if (!delta) return
    event.preventDefault()
    setHandle(handle, currentMinutes + delta)
  }

  const dialStyle = {
    '--sleep-start-angle': `${bedtimeAngle}deg`,
    '--sleep-duration-angle': `${durationAngle}deg`,
  } as CSSProperties

  return <section className="sleep-schedule-picker" aria-label="昨晚睡眠时间">
    <div className="sleep-schedule-heading"><span><Icon name="moon" size={17} />昨晚睡眠</span></div>
    <div className="sleep-time-summary">
      <div className="bedtime"><span><i />入睡</span><strong>{formatClockTime(bedtime)}</strong></div>
      <div className="sleep-time-duration"><strong>{formatSleepDuration(duration / 60)}</strong></div>
      <div className="wake-time"><span><i />起床</span><strong>{formatClockTime(wakeTime)}</strong></div>
    </div>
    <div
      ref={dialRef}
      className="sleep-schedule-dial"
      role="group"
      aria-label="拖动入睡和起床端点选择时间"
      style={dialStyle}
      onPointerDown={handleRingPointerDown}
      onPointerMove={handleRingPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
    >
      <div className="sleep-schedule-progress" />
      <svg className="sleep-clock-scale" viewBox="0 0 240 240" aria-hidden="true">
        {CLOCK_TICKS.map((tick) => {
          const isHour = tick % 4 === 0
          const hour = tick / 4
          const start = clockPoint(hour, isHour ? 81 : 85)
          const end = clockPoint(hour, 90)
          return <line className={isHour ? 'hour' : 'quarter'} key={tick} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
        })}
        {CLOCK_LABELS.map((hour) => {
          const point = clockPoint(hour, 72)
          return <text key={hour} x={point.x} y={point.y}>{String(hour).padStart(2, '0')}</text>
        })}
      </svg>
      <div className="sleep-schedule-handle bedtime" style={{ '--handle-angle': `${bedtimeAngle}deg` } as CSSProperties}>
        <button
          type="button"
          role="slider"
          aria-label="入睡时间"
          aria-valuemin={0}
          aria-valuemax={DAY_MINUTES - STEP_MINUTES}
          aria-valuenow={bedtime}
          aria-valuetext={formatClockTime(bedtime)}
          onPointerDown={(event) => beginHandleDrag('bedtime', event)}
          onPointerMove={moveHandle}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onLostPointerCapture={finishDrag}
          onKeyDown={(event) => handleKeyDown('bedtime', bedtime, event)}
        />
      </div>
      <div className="sleep-schedule-handle wake-time" style={{ '--handle-angle': `${wakeTimeAngle}deg` } as CSSProperties}>
        <button
          type="button"
          role="slider"
          aria-label="起床时间"
          aria-valuemin={0}
          aria-valuemax={DAY_MINUTES - STEP_MINUTES}
          aria-valuenow={wakeTime}
          aria-valuetext={formatClockTime(wakeTime)}
          onPointerDown={(event) => beginHandleDrag('wakeTime', event)}
          onPointerMove={moveHandle}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onLostPointerCapture={finishDrag}
          onKeyDown={(event) => handleKeyDown('wakeTime', wakeTime, event)}
        />
      </div>
      <div className="sleep-schedule-center"><Icon name="moon" size={22} /><strong>{Math.floor(duration / 60)}<span>小时</span></strong><b>{String(duration % 60).padStart(2, '0')} 分钟</b></div>
    </div>
  </section>
}
