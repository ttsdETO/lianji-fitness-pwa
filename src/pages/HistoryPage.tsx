import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { MiniChart } from '../components/MiniChart'
import { formatChineseDate } from '../lib/date'
import { getExerciseTrends, getWorkoutStreak } from '../lib/stats'
import { getWorkoutHistoryDate, sortWorkoutsByCompletion } from '../lib/storage'
import { findDatabaseExercise } from '../data/exerciseDatabase'
import type { AppData } from '../types'

export function HistoryPage({ data }: { data: AppData }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [trendIndex, setTrendIndex] = useState(0)
  const trends = useMemo(() => getExerciseTrends(data.workouts), [data.workouts])
  const averageCompletion = data.workouts.length ? Math.round(data.workouts.reduce((sum, item) => sum + item.completionRate, 0) / data.workouts.length) : 0
  const streak = getWorkoutStreak(data.workouts)
  const currentTrend = trends[trendIndex]
  const historyWorkouts = useMemo(() => sortWorkoutsByCompletion(data.workouts), [data.workouts])

  return <main className="page">
    <header className="page-header"><div><p className="eyebrow">训练档案</p><h1>记录</h1></div><span className="header-icon"><Icon name="history" /></span></header>
    <section className="stat-grid three">
      <div><small>累计训练</small><strong>{data.workouts.length}</strong><span>次</span></div>
      <div><small>平均完成</small><strong>{averageCompletion}</strong><span>%</span></div>
      <div><small>连续周数</small><strong>{streak}</strong><span>周</span></div>
    </section>
    <section className="card trend-card">
      <div className="section-heading"><div><p className="eyebrow">PROGRESS</p><h2>动作趋势</h2></div><Icon name="trend" /></div>
      <div className="segmented compact">
        {trends.map((trend, index) => <button key={trend.key} className={trendIndex === index ? 'active' : ''} onClick={() => setTrendIndex(index)}>{trend.label}</button>)}
      </div>
      <MiniChart points={currentTrend.points.map((point) => ({ label: point.date.slice(5).replace('-', '/'), value: point.value }))} suffix=" 次" />
      <p className="chart-caption">按每次训练的最佳完成次数统计，最近 8 次。</p>
    </section>
    <section className="section-block history-section">
      <div className="section-heading"><div><p className="eyebrow">HISTORY</p><h2>训练历史</h2></div><span>{data.workouts.length} 条</span></div>
      {data.workouts.length === 0 ? <div className="empty-state"><span><Icon name="calendar" size={30} /></span><h3>第一条记录在等你</h3><p>完成今日训练后，各组次数和 RIR 会自动保存在这里。</p></div> : <div className="history-list">
        {historyWorkouts.map((workout) => {
          const open = expandedId === workout.id
          const historyDate = getWorkoutHistoryDate(workout)
          const status = workout.exercises.filter((item) => item.skipped).length
            ? `${workout.exercises.filter((item) => item.skipped).length} 个动作跳过`
            : '全部动作有记录'
          return <article className={`history-card ${open ? 'open' : ''}`} key={workout.id}>
            <button className="history-summary" onClick={() => setExpandedId(open ? null : workout.id)}>
              <span className="history-date"><strong>{formatChineseDate(historyDate)}</strong><small>用时 {workout.durationMinutes} 分钟</small></span>
              <span className="history-title"><strong>{workout.planTitle}</strong><small>{workout.isMakeup ? `原计划 ${formatChineseDate(workout.date)} · ${status}` : status}</small></span>
              <span className="rate-pill">{workout.completionRate}%</span><Icon name="chevron" className={open ? 'rotate' : ''} />
            </button>
            {open && <div className="history-details">
              {workout.exercises.map((exercise) => <div className="history-exercise" key={exercise.exerciseId}>
                <div><strong>{exercise.nameSnapshot ?? exercise.exerciseName}</strong>{exercise.databaseExerciseId && !findDatabaseExercise(exercise.databaseExerciseId) && <span className="missing-database-tag">数据库中已不存在</span>}{exercise.skipped ? <span className="skipped-tag">已跳过</span> : <small>{exercise.sets.filter((set) => set.completed).length}/{exercise.targetSets} 组</small>}</div>
                {exercise.skipped ? <p>原因：{exercise.skipReason || '未填写'}</p> : <div className="set-chips">{exercise.sets.map((set) => <span className={set.completed ? 'complete' : ''} key={set.index}>{set.index}组&nbsp; {set.reps ?? '—'}{exercise.unit}{set.weightKg ? ` · ${set.weightKg} kg` : ''} <em>RIR {set.rir ?? '—'}</em></span>)}</div>}
              </div>)}
              {workout.note && <p className="history-note">备注：{workout.note}</p>}
            </div>}
          </article>
        })}
      </div>}
    </section>
  </main>
}
