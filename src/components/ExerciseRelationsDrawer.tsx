import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { findDatabaseExercise, type DatabaseExercise } from '../data/exerciseDatabase'
import { Icon } from './Icon'

interface Props {
  open: boolean
  exerciseId?: string
  onReplace: (exercise: DatabaseExercise) => void
  onClose: () => void
}

export function ExerciseRelationsDrawer({ open, exerciseId, onReplace, onClose }: Props) {
  const exercise = findDatabaseExercise(exerciseId)
  const regressions = useMemo(() => exercise?.regressions.map(findDatabaseExercise).filter((item): item is DatabaseExercise => Boolean(item)) ?? [], [exercise])
  const progressions = useMemo(() => exercise?.progressions.map(findDatabaseExercise).filter((item): item is DatabaseExercise => Boolean(item)) ?? [], [exercise])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('library-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('library-open')
    }
  }, [onClose, open])

  if (!open) return null

  const renderRelation = (item: DatabaseExercise, direction: '退阶' | '进阶') => <article className="relation-option" key={item.id}>
    <div><small>{direction} · {item.difficulty}</small><h3>{item.name}</h3><p>{item.primaryMuscles.slice(0, 2).join('、')} · {item.equipment.slice(0, 2).join('、')}</p></div>
    <button type="button" className="button primary" onClick={() => onReplace(item)}>换成此动作</button>
  </article>

  return createPortal(<div className="library-backdrop" role="presentation">
    <section className="exercise-library progression-library" role="dialog" aria-modal="true" aria-label={`${exercise?.name ?? '当前动作'}的进退阶动作`}>
      <header className="library-header"><div><p className="eyebrow">调整训练计划</p><h2>动作进退阶</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="关闭进退阶选择并返回设置"><Icon name="close" /></button></header>
      <div className="progression-content">
        {exercise ? <>
          <div className="progression-hero"><p className="eyebrow">当前动作</p><h1>{exercise.name}</h1><p>{exercise.difficulty} · {exercise.category} · {exercise.primaryMuscles.slice(0, 3).join('、')}</p></div>
          {regressions.length > 0 && <section className="relation-group"><div className="library-section-title"><strong>降低难度</strong><small>更容易控制的退阶动作</small></div><div>{regressions.map((item) => renderRelation(item, '退阶'))}</div></section>}
          {progressions.length > 0 && <section className="relation-group"><div className="library-section-title"><strong>提高难度</strong><small>准备充分后再进阶</small></div><div>{progressions.map((item) => renderRelation(item, '进阶'))}</div></section>}
          {regressions.length === 0 && progressions.length === 0 && <div className="relation-empty"><Icon name="info" /><strong>暂未收录进退阶动作</strong><p>这个动作目前没有对应的退阶或进阶。你可以直接返回设置，原训练计划不会改变。</p></div>}
        </> : <div className="relation-empty"><Icon name="warning" /><strong>没有找到关联动作</strong><p>请返回设置后重新打开该动作。</p></div>}
        <button type="button" className="button secondary full progression-return" onClick={onClose}>返回设置</button>
      </div>
    </section>
  </div>, document.body)
}
