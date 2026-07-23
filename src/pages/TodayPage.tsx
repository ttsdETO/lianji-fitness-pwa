import { useEffect, useMemo, useState } from 'react'
import { ExerciseDrawer } from '../components/ExerciseDrawer'
import { Icon } from '../components/Icon'
import { SetCountdown } from '../components/SetCountdown'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { WarmupDrawer } from '../components/WarmupDrawer'
import { getPostWorkoutStretching, warmup } from '../data/workoutPlan'
import { addDays, formatChineseDate, getWeekdayName, getWeekStart, toLocalISODate } from '../lib/date'
import { createWorkoutExerciseRecord, resolveTrainingDayForDate, resolveWeeklyPlanForDate, syncWorkoutDraftWithPlan, WEEKDAYS } from '../lib/plan'
import { getRecoveryAdvice } from '../lib/recovery'
import { upsertDraft, upsertWorkout } from '../lib/storage'
import type { AppData, Exercise, TrainingDay, WarmupExercise, WorkoutDraft, WorkoutExerciseRecord, WorkoutRecord } from '../types'
import type { TabId } from '../components/BottomNav'

interface Props {
  data: AppData
  setData: React.Dispatch<React.SetStateAction<AppData>>
  onStartRest: (seconds: number, exerciseName: string) => void
  onStopRest: () => void
  onNavigate: (tab: TabId) => void
}

const restLabel = (seconds: number) => seconds >= 120 ? `${seconds / 60} 分钟` : `${seconds} 秒`
type SessionPhase = 'warmup' | 'training' | 'stretch'

function SessionPhaseTabs({ value, warmupCount, trainingCount, stretchCount, onChange }: { value: SessionPhase; warmupCount: number; trainingCount: number; stretchCount: number; onChange: (phase: SessionPhase) => void }) {
  const tabs: { id: SessionPhase; label: string; count: number }[] = [
    { id: 'warmup', label: '热身', count: warmupCount },
    { id: 'training', label: '正式训练', count: trainingCount },
    { id: 'stretch', label: '拉伸', count: stretchCount },
  ]
  return <div className="session-phase-tabs" role="tablist" aria-label="训练阶段">
    {tabs.map((tab) => <button type="button" role="tab" aria-selected={value === tab.id} className={value === tab.id ? 'active' : ''} key={tab.id} onClick={() => onChange(tab.id)}><strong>{tab.label}</strong><small>{tab.count} 项</small></button>)}
  </div>
}

function GuidedExercisePanel({ phase, items, active = false, onSelect, onContinue }: { phase: 'warmup' | 'stretch'; items: WarmupExercise[]; active?: boolean; onSelect: (item: WarmupExercise) => void; onContinue?: () => void }) {
  const isStretch = phase === 'stretch'
  const title = isStretch ? '拉伸' : '热身'

  if (active) return <section className={`session-guide-active ${phase}`} role="tabpanel">
    <div className="exercise-stack guided-exercise-stack">{items.map((item, index) => <article className="exercise-card guided-exercise-card" key={item.id}>
      <header><button type="button" className="exercise-title" onClick={() => onSelect(item)}><span className="index">{String(index + 1).padStart(2, '0')}</span><span><strong>{item.name}{item.optional ? '（可选）' : ''}</strong><small>{item.dose} · {item.purpose}</small></span></button><button type="button" className="icon-button" onClick={() => onSelect(item)} aria-label={`查看${item.name}详情`}><Icon name="info" /></button></header>
      <button type="button" className="exercise-cue" onClick={() => onSelect(item)}><Icon name="spark" size={16} /><span><strong>{title}提示</strong><em>{item.tips[0] ?? item.purpose}</em></span><Icon name="chevron" size={16} /></button>
    </article>)}</div>
    {isStretch && <div className="notice recovery-normal session-guide-note"><Icon name="spark" /><div><strong>拉伸原则</strong><p>每侧保持 20–30 秒，腹部 10–20 秒；保持正常呼吸，不弹振、不追求疼痛。</p></div></div>}
    {onContinue && <button type="button" className="button secondary full phase-continue" onClick={onContinue}>{isStretch ? '返回正式训练' : '热身完成，进入正式训练'}<Icon name="chevron" size={16} /></button>}
  </section>

  return <section className={`plan-preview session-training-preview session-guide-panel ${phase}`} role="tabpanel">
    <div className="section-heading"><div><p className="eyebrow">今日内容</p><h2>{title}清单</h2></div></div>
    {items.map((item, index) => <button type="button" className="preview-row" key={item.id} onClick={() => onSelect(item)}>
      <span className="index">{String(index + 1).padStart(2, '0')}</span>
      <span className="preview-copy"><strong>{item.name}{item.optional ? '（可选）' : ''}</strong><small>{item.dose} · {item.purpose}</small></span>
      <Icon name="chevron" size={17} />
    </button>)}
    {isStretch && <div className="notice recovery-normal session-guide-note"><Icon name="spark" /><div><strong>拉伸原则</strong><p>每侧保持 20–30 秒，腹部 10–20 秒；保持正常呼吸，不弹振、不追求疼痛。</p></div></div>}
    {onContinue && <button type="button" className="button secondary full phase-continue" onClick={onContinue}>{isStretch ? '返回正式训练' : '热身完成，进入正式训练'}<Icon name="chevron" size={16} /></button>}
  </section>
}

function MakeupOptions({ items, disabled, onStart }: { items: { date: string; plan: TrainingDay }[]; disabled: boolean; onStart: (date: string) => void }) {
  if (items.length === 0) return null

  return <details className="makeup-options">
    <summary><span><Icon name="history" /><span><strong>本周补练</strong><small>{items.length} 个未完成训练可选择</small></span></span><Icon name="chevron" /></summary>
    <div className="makeup-options-list">
      {items.map(({ date, plan }) => <div className="makeup-option-row" key={date}>
        <span><strong>{formatChineseDate(date)}</strong><small>{plan.focus}</small></span>
        <span><strong>{plan.title}</strong><small>{plan.exercises.length} 个动作</small></span>
        <button className="makeup-start-button" type="button" disabled={disabled} onClick={() => onStart(date)}>{disabled ? '今日建议休息' : '开始补练'}</button>
      </div>)}
    </div>
  </details>
}

export function TodayPage({ data, setData, onStartRest, onStopRest, onNavigate }: Props) {
  const today = toLocalISODate()
  const weekday = new Date().getDay()
  const advice = getRecoveryAdvice(today, data.recoveryRecords)
  const existingDraft = data.workoutDrafts[today] ?? Object.values(data.workoutDrafts).find((item) => item.performedDate === today)
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [selectedWarmup, setSelectedWarmup] = useState<WarmupExercise | null>(null)
  const [previewPhase, setPreviewPhase] = useState<SessionPhase>('training')
  const [activePhase, setActivePhase] = useState<SessionPhase>(existingDraft ? 'training' : 'warmup')
  const [noteOpen, setNoteOpen] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [showEmptySaveConfirm, setShowEmptySaveConfirm] = useState(false)

  const todayPlan = useMemo(() => resolveTrainingDayForDate(data.settings, today), [data.settings, today])
  const draft = existingDraft
  const workoutDate = draft?.date ?? today
  const activePlan = useMemo(() => resolveTrainingDayForDate(data.settings, workoutDate), [data.settings, workoutDate])
  const currentWeekPlan = useMemo(() => resolveWeeklyPlanForDate(data.settings, today), [data.settings, today])
  const plan = draft ? activePlan : todayPlan
  const postWorkoutStretching = useMemo(() => plan ? getPostWorkoutStretching(plan.exercises) : [], [plan])
  const completedWorkout = data.workouts.find((item) => item.date === today && !item.isMakeup)
  const completedRecovery = data.recoveryRecords.some((item) => item.date === today)
  const makeupCandidates = useMemo(() => {
    const candidates: { date: string; plan: TrainingDay }[] = []
    const weekStart = getWeekStart(today, data.settings.weekStartsOn)
    for (let date = weekStart; date < today; date = addDays(date, 1)) {
      const scheduledPlan = resolveTrainingDayForDate(data.settings, date)
      const completed = data.workouts.some((item) => item.date === date)
      if (scheduledPlan && !completed && !data.workoutDrafts[date]) candidates.push({ date, plan: scheduledPlan })
    }
    return candidates
  }, [data.settings, data.workouts, data.workoutDrafts, today])

  useEffect(() => {
    if (!draft || !activePlan) return
    const synced = syncWorkoutDraftWithPlan(draft, activePlan)
    if (synced === draft) return
    setData((current) => {
      const currentDraft = current.workoutDrafts[workoutDate]
      const currentPlan = resolveTrainingDayForDate(current.settings, workoutDate)
      if (!currentDraft || !currentPlan) return current
      const next = syncWorkoutDraftWithPlan(currentDraft, currentPlan)
      return next === currentDraft ? current : upsertDraft(current, { ...next, updatedAt: new Date().toISOString() })
    })
  }, [activePlan, draft, setData, workoutDate])

  const startWorkout = (targetDate: string) => {
    const targetPlan = resolveTrainingDayForDate(data.settings, targetDate)
    if (!targetPlan || advice.level === 'rest') return
    const isMakeup = targetDate !== today
    const targetReduction = advice.level === 'reduce' ? 1 : 0
    const exercises: WorkoutExerciseRecord[] = targetPlan.exercises.map((item) => createWorkoutExerciseRecord(item, targetReduction))
    const now = new Date().toISOString()
    const nextDraft: WorkoutDraft = {
      id: `${targetDate}_${targetPlan.id}`,
      date: targetDate,
      performedDate: today,
      isMakeup,
      planId: targetPlan.id,
      planTitle: isMakeup ? `补练 · ${targetPlan.title}` : targetPlan.title,
      startedAt: now,
      updatedAt: now,
      recoveryAdjustment: advice.level === 'reduce' ? 'reduce' : 'none',
      exercises,
      note: '',
    }
    setActivePhase('warmup')
    setData((current) => upsertDraft(current, nextDraft))
  }

  const updateDraft = (updater: (current: WorkoutDraft) => WorkoutDraft) => {
    setData((current) => {
      const currentDraft = current.workoutDrafts[workoutDate]
      if (!currentDraft) return current
      return upsertDraft(current, { ...updater(currentDraft), updatedAt: new Date().toISOString() })
    })
  }

  const updateExercise = (exerciseId: string, updater: (item: WorkoutExerciseRecord) => WorkoutExerciseRecord) => {
    updateDraft((current) => ({
      ...current,
      exercises: current.exercises.map((item) => item.exerciseId === exerciseId ? updater(item) : item),
    }))
  }

  const setSetCompleted = (exercise: Exercise, setIndex: number, completed: boolean) => {
    const record = draft?.exercises.find((item) => item.exerciseId === exercise.id)
    const previous = record?.sets[setIndex]
    if (!previous || previous.completed === completed) return
    updateExercise(exercise.id, (item) => ({
      ...item,
      skipped: false,
      skipReason: '',
      sets: item.sets.map((set, index) => index === setIndex ? {
        ...set,
        reps: completed && set.reps === null ? (exercise.unit === '秒' ? item.timerSeconds ?? exercise.timerSeconds ?? exercise.repsMin : exercise.repsMin) : set.reps,
        weightKg: completed && set.weightKg === null ? exercise.targetWeightKg ?? null : set.weightKg,
        rir: completed && set.rir === null ? exercise.targetRir ?? 2 : set.rir,
        completed,
      } : set),
    }))
    if (completed && exercise.restSeconds > 0) onStartRest(exercise.restSeconds, exercise.name)
  }

  const toggleSet = (exercise: Exercise, setIndex: number) => {
    const completed = draft?.exercises.find((item) => item.exerciseId === exercise.id)?.sets[setIndex]?.completed
    if (completed === undefined) return
    setSetCompleted(exercise, setIndex, !completed)
  }

  const saveWorkout = () => {
    if (!draft) return
    const total = draft.exercises.reduce((sum, item) => sum + item.targetSets, 0)
    const completed = draft.exercises.reduce((sum, item) => sum + item.sets.filter((set) => set.completed).length, 0)
    const completedAt = new Date()
    const record: WorkoutRecord = {
      ...draft,
      completedAt: completedAt.toISOString(),
      durationMinutes: Math.max(1, Math.round((completedAt.getTime() - new Date(draft.startedAt).getTime()) / 60_000)),
      completionRate: total ? Math.round((completed / total) * 100) : 0,
    }
    const {
      updatedAt: _updatedAt,
      stopwatchElapsedSeconds: _stopwatchElapsedSeconds,
      stopwatchSegmentSeconds: _stopwatchSegmentSeconds,
      stopwatchStartedAt: _stopwatchStartedAt,
      stopwatchRunning: _stopwatchRunning,
      ...cleanRecord
    } = record as WorkoutRecord & Pick<WorkoutDraft, 'updatedAt' | 'stopwatchElapsedSeconds' | 'stopwatchSegmentSeconds' | 'stopwatchStartedAt' | 'stopwatchRunning'>
    onStopRest()
    setData((current) => upsertWorkout(current, cleanRecord))
  }

  const finishWorkout = () => {
    if (!draft) return
    const completed = draft.exercises.reduce((sum, item) => sum + item.sets.filter((set) => set.completed).length, 0)
    if (completed === 0) {
      setShowEmptySaveConfirm(true)
      return
    }
    saveWorkout()
  }

  const confirmEmptyWorkoutSave = () => {
    setShowEmptySaveConfirm(false)
    saveWorkout()
  }

  const discardWorkout = () => {
    onStopRest()
    setShowExitConfirm(false)
    setData((current) => ({
      ...current,
      workoutDrafts: Object.fromEntries(Object.entries(current.workoutDrafts).filter(([date]) => date !== workoutDate)),
    }))
  }

  if (!plan) {
    return <main className="page today-page">
      <header className="hero compact">
        <div><p className="eyebrow">{formatChineseDate(today, true)}</p><h1>恢复也是训练</h1><p>{getWeekdayName(weekday)} · 今日无正式力量训练</p></div>
        <div className="day-orb rest"><Icon name="moon" size={28} /></div>
      </header>
      <MakeupOptions items={makeupCandidates} disabled={advice.level === 'rest'} onStart={startWorkout} />
      <section className="rest-day-card">
        <span className="rest-mark"><Icon name="recovery" size={34} /></span>
        <h2>让身体变强的休息日</h2>
        <p>轻松散步、活动关节，吃够正餐和蛋白质。今晚尽量把睡眠推近 8 小时。</p>
        {completedRecovery && <div className="form-message success"><Icon name="check" size={17} />今日恢复状态已保存</div>}
      </section>
      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">本周节奏</p><h2>四练三休</h2></div></div>
        <div className="week-strip">
          {WEEKDAYS.map((day) => {
            const item = currentWeekPlan.find((planDay) => planDay.weekday === day)
            return <div key={day} className={weekday === day ? 'current' : ''}><small>{getWeekdayName(day).slice(1)}</small><strong>{item?.enabled ? item.title.slice(0, 2) : '休'}</strong></div>
          })}
        </div>
      </section>
    </main>
  }

  if (completedWorkout && !draft) {
    return <main className="page today-page">
      <header className="hero compact"><div><p className="eyebrow">{formatChineseDate(today, true)}</p><h1>今日已完成</h1><p>{completedWorkout.planTitle} · {completedWorkout.durationMinutes} 分钟</p></div><div className="day-orb done"><Icon name="check" size={32} /></div></header>
      <MakeupOptions items={makeupCandidates} disabled={advice.level === 'rest'} onStart={startWorkout} />
      <section className="completion-card">
        <div className="completion-ring" style={{ '--value': `${completedWorkout.completionRate * 3.6}deg` } as React.CSSProperties}><strong>{completedWorkout.completionRate}%</strong><span>完成率</span></div>
        <div><p className="eyebrow">GOOD WORK</p><h2>训练已经存档</h2><p>身体是在恢复中变强的。下一步：吃好、喝水，今晚早点睡。</p></div>
      </section>
      <button className="button secondary full" onClick={() => onNavigate('history')}>查看本次记录</button>
    </main>
  }

  if (!draft) {
    return <main className="page today-page">
      <header className="hero">
        <div><p className="eyebrow">{formatChineseDate(today, true)}</p><h1>{plan.title}</h1><p>{plan.focus}</p></div>
        <div className="day-orb"><strong>{plan.exercises.length}</strong><span>动作</span></div>
      </header>
      <MakeupOptions items={makeupCandidates} disabled={advice.level === 'rest'} onStart={startWorkout} />
      <div className={`notice recovery-${advice.level} ${advice.title.includes('补充') ? 'today-recovery-prompt' : ''}`}>
        <Icon name={advice.level === 'normal' ? 'spark' : advice.level === 'reduce' ? 'moon' : 'warning'} />
        <div><strong>{advice.title}</strong><p>{advice.message}</p></div>
        {advice.title.includes('补充') && <button className="recovery-prompt-action" onClick={() => onNavigate('recovery')}>去填写<Icon name="chevron" size={15} /></button>}
      </div>
      <section className="session-overview">
        <div><small>预计用时</small><strong>{plan.duration}</strong></div>
        <div><small>目标强度</small><strong>RIR {plan.exercises[0]?.targetRir ?? 2}</strong></div>
        <div><small>本次组数</small><strong>{plan.exercises.reduce((sum, item) => sum + Math.max(1, item.sets - (advice.level === 'reduce' ? 1 : 0)), 0)} 组</strong></div>
      </section>
      <SessionPhaseTabs value={previewPhase} warmupCount={warmup.length} trainingCount={plan.exercises.length} stretchCount={postWorkoutStretching.length} onChange={setPreviewPhase} />
      {previewPhase === 'warmup' && <GuidedExercisePanel phase="warmup" items={warmup} onSelect={setSelectedWarmup} onContinue={() => setPreviewPhase('training')} />}
      {previewPhase === 'training' && <section className="plan-preview session-training-preview" role="tabpanel">
        <div className="section-heading"><div><p className="eyebrow">今日内容</p><h2>动作清单</h2></div></div>
        {plan.exercises.map((item, index) => <button className="preview-row" key={item.id} onClick={() => setSelectedExercise(item)}>
          <span className="index">{String(index + 1).padStart(2, '0')}</span><span className="preview-copy"><strong>{item.name}</strong><small>{Math.max(1, item.sets - (advice.level === 'reduce' ? 1 : 0))} 组 × {item.unit === '秒' ? `${item.timerSeconds ?? item.repsMin} 秒倒计时` : `${item.repsMin}${item.repsMax !== item.repsMin ? `–${item.repsMax}` : ''} 次`}{item.perSide ? ' / 侧' : ''}{item.targetWeightKg ? ` · ${item.targetWeightKg} kg` : ''} · RIR {item.targetRir ?? 2}</small></span><Icon name="chevron" />
        </button>)}
      </section>}
      {previewPhase === 'stretch' && <GuidedExercisePanel phase="stretch" items={postWorkoutStretching} onSelect={setSelectedWarmup} onContinue={() => setPreviewPhase('training')} />}
      <div className="start-dock"><button className="button primary full large" disabled={advice.level === 'rest'} onClick={() => startWorkout(today)}><Icon name="play" />{advice.level === 'rest' ? '今天按计划休息' : advice.level === 'reduce' ? '开始减量训练' : '开始今日训练'}</button></div>
      <ExerciseDrawer exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />
      <WarmupDrawer item={selectedWarmup} onClose={() => setSelectedWarmup(null)} />
    </main>
  }

  const completedSets = draft.exercises.reduce((sum, item) => sum + item.sets.filter((set) => set.completed).length, 0)
  const totalSets = draft.exercises.reduce((sum, item) => sum + item.targetSets, 0)
  return <main className="page workout-active-page">
    <header className="active-header"><div><p className="eyebrow">{draft.isMakeup ? `${formatChineseDate(draft.date)}补练` : '训练进行中'}</p><h1>{draft.planTitle}</h1></div><div className="active-header-controls"><button className="exit-workout-button" onClick={() => setShowExitConfirm(true)}><Icon name="close" size={15} />不保存退出</button><div className="set-progress"><strong>{completedSets}</strong><span>/ {totalSets} 组</span></div></div></header>
          <div className="progress-track"><span style={{ '--progress-scale': totalSets ? completedSets / totalSets : 0 } as React.CSSProperties} /></div>
    {draft.recoveryAdjustment === 'reduce' && <div className="notice recovery-reduce compact-notice"><Icon name="moon" /><div><strong>已按睡眠状态减量</strong><p>每个动作比原计划少 1 组。</p></div></div>}
    <SessionPhaseTabs value={activePhase} warmupCount={warmup.length} trainingCount={draft.exercises.length} stretchCount={postWorkoutStretching.length} onChange={setActivePhase} />
    {activePhase === 'warmup' && <GuidedExercisePanel phase="warmup" items={warmup} active onSelect={setSelectedWarmup} onContinue={() => setActivePhase('training')} />}
    {activePhase === 'training' && <div className="exercise-stack" role="tabpanel">
      {draft.exercises.map((record, exerciseIndex) => {
        const item = plan.exercises.find((exercise) => exercise.id === record.exerciseId)
        if (!item) return null
        const done = record.sets.every((set) => set.completed)
        return <article className={`exercise-card ${done ? 'done' : ''} ${record.skipped ? 'skipped' : ''}`} key={record.exerciseId}>
          <header><button className="exercise-title" onClick={() => setSelectedExercise(item)}><span className="index">{String(exerciseIndex + 1).padStart(2, '0')}</span><span><strong>{record.exerciseName}</strong><small>{item.equipment} · 休息 {restLabel(item.restSeconds)}</small></span></button><button className="icon-button" onClick={() => setSelectedExercise(item)} aria-label="查看动作详情"><Icon name="info" /></button></header>
          <button className="exercise-cue" onClick={() => setSelectedExercise(item)}><Icon name="spark" size={16} /><span><strong>动作提示</strong><em>{[item.tempo, item.tips[0]].filter(Boolean).join(' · ')}</em></span><Icon name="chevron" size={16} /></button>
          {item.condition && <p className="condition-line"><Icon name="warning" size={16} />{item.condition}</p>}
          {!record.skipped && <div className="set-table">
            <div className="set-table-head"><span>组</span><span>{item.unit === '秒' ? '倒计时' : `实际${item.unit}`}{item.perSide ? ' / 每侧' : ''}</span><span>重量</span><span>RIR</span><span>完成</span></div>
            {record.sets.map((set, setIndex) => <div className={`set-row ${set.completed ? 'completed' : ''}`} key={set.index}>
              <strong>{set.index}</strong>
              {item.unit === '秒'
                ? <SetCountdown seconds={record.timerSeconds ?? item.timerSeconds ?? item.repsMin} completed={set.completed} label={`${item.name}第${set.index}组`} onComplete={() => setSetCompleted(item, setIndex, true)} />
                : <label><input inputMode="numeric" type="number" min="0" max="999" value={set.reps ?? ''} placeholder={`${item.repsMin}–${item.repsMax}`} onChange={(event) => updateExercise(item.id, (current) => ({ ...current, sets: current.sets.map((entry, index) => index === setIndex ? { ...entry, reps: event.target.value === '' ? null : Number(event.target.value) } : entry) }))} aria-label={`${item.name}第${set.index}组实际${item.unit}`} /><span>{item.unit}</span></label>}
              <label><input inputMode="decimal" type="number" min="0" max="999" step="0.5" value={set.weightKg ?? ''} placeholder={String(item.targetWeightKg ?? 0)} onChange={(event) => updateExercise(item.id, (current) => ({ ...current, sets: current.sets.map((entry, index) => index === setIndex ? { ...entry, weightKg: event.target.value === '' ? null : Number(event.target.value) } : entry) }))} aria-label={`${item.name}第${set.index}组实际重量`} /><span>kg</span></label>
              <select value={set.rir ?? ''} onChange={(event) => updateExercise(item.id, (current) => ({ ...current, sets: current.sets.map((entry, index) => index === setIndex ? { ...entry, rir: event.target.value === '' ? null : Number(event.target.value) } : entry) }))} aria-label={`${item.name}第${set.index}组RIR`}><option value="">—</option>{[0, 1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select>
              <button className="set-check" onClick={() => toggleSet(item, setIndex)} aria-label={set.completed ? '取消完成' : '完成该组'}><Icon name="check" size={20} /></button>
            </div>)}
          </div>}
          {record.skipped ? <div className="skip-panel"><label>跳过原因<textarea value={record.skipReason} autoFocus placeholder="例如：肩部有夹痛，已停止" onChange={(event) => updateExercise(item.id, (current) => ({ ...current, skipReason: event.target.value }))} /></label><button className="text-button" onClick={() => updateExercise(item.id, (current) => ({ ...current, skipped: false, skipReason: '' }))}>恢复这个动作</button></div> : <button className="skip-button" onClick={() => updateExercise(item.id, (current) => ({ ...current, skipped: true, sets: current.sets.map((set) => ({ ...set, completed: false })) }))}>跳过动作并填写原因</button>}
        </article>
      })}
      <button type="button" className="button secondary full phase-continue training-to-stretch" onClick={() => setActivePhase('stretch')}>正式训练完成，查看拉伸<Icon name="chevron" size={16} /></button>
    </div>}
    {activePhase === 'stretch' && <GuidedExercisePanel phase="stretch" items={postWorkoutStretching} active onSelect={setSelectedWarmup} onContinue={() => setActivePhase('training')} />}
    <button className="warmup-toggle note-toggle" onClick={() => setNoteOpen((value) => !value)}><span><Icon name="plus" />添加本次训练备注</span><Icon name="chevron" className={noteOpen ? 'rotate' : ''} /></button>
    {noteOpen && <textarea className="session-note" value={draft.note} placeholder="今天的状态、动作调整……" onChange={(event) => updateDraft((current) => ({ ...current, note: event.target.value }))} />}
    <button className="button primary full large finish-button" onClick={finishWorkout}><Icon name="check" />结束并保存训练</button>
    <p className="safety-footnote">动作完整和稳定优先。关节刺痛、锐痛或明显不适时立即停止。</p>
    <ExerciseDrawer exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />
    <WarmupDrawer item={selectedWarmup} onClose={() => setSelectedWarmup(null)} />
    <ConfirmDialog
      open={showExitConfirm}
      eyebrow="退出本次训练"
      title="不保存并退出？"
      message="本次尚未保存的组数、RIR、倒计时进度和训练备注都会被删除。"
      details={['历史训练记录不会受到影响', '退出后可以重新开始今日训练']}
      icon="close"
      confirmLabel="不保存并退出"
      onCancel={() => setShowExitConfirm(false)}
      onConfirm={discardWorkout}
    />
    <ConfirmDialog
      open={showEmptySaveConfirm}
      eyebrow={draft.isMakeup ? '保存本次补练' : '保存本次训练'}
      title="还没有完成任何一组"
      message="如果继续，本次训练会以 0% 完成度保存到历史记录并退出训练页面。"
      details={['当前填写的训练备注会一并保存', '保存后可在历史记录中查看本次训练']}
      icon="warning"
      confirmLabel="仍然保存并退出"
      variant="warning"
      onCancel={() => setShowEmptySaveConfirm(false)}
      onConfirm={confirmEmptyWorkoutSave}
    />
  </main>
}
