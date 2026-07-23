import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Exercise } from '../types'
import { findDatabaseExercise } from '../data/exerciseDatabase'
import { Icon } from './Icon'

export function ExerciseDrawer({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  useEffect(() => {
    if (!exercise) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('drawer-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('drawer-open')
    }
  }, [exercise, onClose])

  if (!exercise) return null
  return createPortal(<div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="exercise-drawer" role="dialog" aria-modal="true" aria-label={`${exercise.name}动作详情`}>
      <div className="drawer-topbar">
        <div className="drawer-handle" />
        <button className="icon-button drawer-close" onClick={onClose} aria-label="关闭"><Icon name="close" /></button>
      </div>
      <div className="exercise-visual" aria-hidden="true">
        <span>动</span>
        <div><strong>{exercise.category}</strong><small>{exercise.equipment}</small></div>
      </div>
      <p className="eyebrow">动作说明</p>
      <h2>{exercise.name}</h2>
      <p className="drawer-target">{exercise.sets} 组 × {exercise.unit === '秒' ? `${exercise.timerSeconds ?? exercise.repsMin} 秒倒计时` : `${exercise.repsMin}${exercise.repsMax !== exercise.repsMin ? `–${exercise.repsMax}` : ''} 次`}{exercise.perSide ? ' / 每侧' : ''} · 休息 {Math.round(exercise.restSeconds / 30) * 0.5} 分钟{exercise.targetWeightKg ? ` · ${exercise.targetWeightKg} kg` : ''} · RIR {exercise.targetRir ?? 2}</p>
      {exercise.aliases?.length ? <p className="drawer-aliases">别名：{exercise.aliases.join('、')}</p> : null}
      {exercise.condition && <div className="notice warning"><Icon name="warning" /><div><strong>执行条件</strong><p>{exercise.condition}</p></div></div>}
      {exercise.primaryMuscles?.length ? <div className="detail-facts drawer-facts">
        <div><small>主要肌群</small><strong>{exercise.primaryMuscles.join('、')}</strong></div>
        <div><small>次要肌群</small><strong>{exercise.secondaryMuscles?.join('、') || '—'}</strong></div>
        <div><small>训练部位</small><strong>{exercise.bodyParts?.join('、') || '—'}</strong></div>
        <div><small>动作模式</small><strong>{exercise.movementPatterns?.join('、') || '—'}</strong></div>
      </div> : null}
      {exercise.effects?.length ? <div className="detail-section"><h3>训练效果</h3><ul>{exercise.effects.map((effect) => <li key={effect}>{effect}</li>)}</ul></div> : null}
      <div className="detail-section">
        <h3>怎么做</h3>
        <ol>{exercise.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      </div>
      <div className="detail-grid">
        <div className="detail-section"><h3>关键提示</h3><ul>{exercise.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></div>
        <div className="detail-section"><h3>常见错误</h3><ul>{exercise.mistakes.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </div>
      <div className="notice danger"><Icon name="warning" /><div><strong>疼痛警告</strong><p>{exercise.painWarning}</p></div></div>
      {(exercise.regressions?.length || exercise.progressions?.length) ? <div className="exercise-relations drawer-relations">
        {exercise.regressions?.length ? <div><small>退阶动作</small><span>{exercise.regressions.map((id) => <em key={id}>{findDatabaseExercise(id)?.name ?? id}</em>)}</span></div> : null}
        {exercise.progressions?.length ? <div><small>进阶动作</small><span>{exercise.progressions.map((id) => <em key={id}>{findDatabaseExercise(id)?.name ?? id}</em>)}</span></div> : null}
      </div> : null}
      {exercise.notes && <div className="notice"><Icon name="info" /><div><strong>个人备注</strong><p>{exercise.notes}</p></div></div>}
      <div className="drawer-action-bar"><button className="button primary full" onClick={onClose}>我知道了</button></div>
    </section>
  </div>, document.body)
}
