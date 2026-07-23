import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { databaseExercises, findDatabaseExercise, type DatabaseExercise, type ExerciseDifficulty } from '../data/exerciseDatabase'
import { searchExercises, type ExerciseSearchFilters } from '../lib/exerciseSearch'
import type { ExerciseTutorial } from '../types'
import { BilibiliTutorialPanel } from './BilibiliTutorialPanel'
import { Icon } from './Icon'

interface Props {
  open: boolean
  favoriteIds: string[]
  recentIds: string[]
  currentExerciseIds: string[]
  tutorials: Record<string, ExerciseTutorial | null>
  onToggleFavorite: (exerciseId: string) => void
  onSaveTutorial: (exerciseId: string, tutorial: ExerciseTutorial | null) => void
  onAdd: (exercises: DatabaseExercise[]) => void
  onClose: () => void
}

const BODY_PARTS = ['胸', '背', '肩', '手臂', '核心', '臀', '大腿', '小腿', '全身']
const CATEGORIES = ['上肢推', '上肢拉', '手臂', '下肢', '核心', '心肺与爆发', '热身与活动', '拉伸']
const EQUIPMENT = ['徒手', '哑铃', '单杠', '瑜伽垫', '墙面', '牢固支撑面']
const DIFFICULTIES: ExerciseDifficulty[] = ['入门', '初级', '中级']
const MOVEMENT_PATTERNS = ['水平推', '垂直推', '水平拉', '垂直拉', '蹲', '髋铰链', '单腿', '抗伸展', '抗旋转', '跳跃']

const prescriptionLabel = (exercise: DatabaseExercise) => `${exercise.defaultPrescription.sets} 组 × ${exercise.defaultPrescription.reps} · 休息 ${exercise.defaultPrescription.restSeconds} 秒`

export function ExerciseLibrary({ open, favoriteIds, recentIds, currentExerciseIds, tutorials, onToggleFavorite, onSaveTutorial, onAdd, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<ExerciseSearchFilters>({})
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    if (open) return
    setDetailId(null)
    setSelectedIds([])
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (detailId) setDetailId(null)
      else onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('library-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('library-open')
    }
  }, [detailId, onClose, open])

  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds])
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const currentExerciseIdSet = useMemo(() => new Set(currentExerciseIds), [currentExerciseIds])
  const results = useMemo(() => open ? searchExercises(databaseExercises, deferredQuery, { ...filters, favoriteIds }) : [], [deferredQuery, favoriteIds, filters, open])
  const recentExercises = useMemo(() => open ? recentIds.map(findDatabaseExercise).filter((item): item is DatabaseExercise => Boolean(item)).slice(0, 16) : [], [open, recentIds])
  const detail = findDatabaseExercise(detailId ?? undefined)
  const hasFilters = Boolean(filters.bodyPart || filters.category || filters.equipment || filters.difficulty || filters.movementPattern || filters.favoritesOnly)
  const activeFilterCount = [filters.bodyPart, filters.category, filters.equipment, filters.difficulty, filters.movementPattern, filters.favoritesOnly].filter(Boolean).length

  if (!open) return null

  const setFilter = <K extends keyof ExerciseSearchFilters>(key: K, value: ExerciseSearchFilters[K]) => setFilters((current) => ({ ...current, [key]: value || undefined }))
  const toggleSelected = (exerciseId: string) => setSelectedIds((current) => current.includes(exerciseId) ? current.filter((id) => id !== exerciseId) : [...current, exerciseId])
  const addSelected = () => {
    const exercises = selectedIds.map(findDatabaseExercise).filter((item): item is DatabaseExercise => Boolean(item))
    if (exercises.length) onAdd(exercises)
    setSelectedIds([])
  }

  const renderCard = (exercise: DatabaseExercise, compact = false) => {
    const selected = selectedIdSet.has(exercise.id)
    const favorite = favoriteIdSet.has(exercise.id)
    const alreadyAdded = currentExerciseIdSet.has(exercise.id)
    const hasTutorial = Boolean(tutorials[exercise.id])
    return <article className={`library-card ${selected ? 'selected' : ''} ${compact ? 'compact' : ''}`} key={exercise.id}>
      <button type="button" className="library-card-main" onClick={() => setDetailId(exercise.id)} aria-label={`查看${exercise.name}详情`}>
        <span className="library-card-heading"><strong>{exercise.name}</strong><small>{exercise.difficulty} · {exercise.category}</small></span>
        <span className="library-card-tags"><em>{exercise.primaryMuscles.slice(0, 2).join('、')}</em><em>{exercise.equipment.slice(0, 2).join('、')}</em></span>
        <span className="library-prescription">{prescriptionLabel(exercise)}</span>
        {(alreadyAdded || hasTutorial) && <span className="library-card-badges">
          {alreadyAdded && <span className="already-added">计划中已有</span>}
          {hasTutorial && <span className="tutorial-available"><Icon name="play" size={10} />有教程</span>}
        </span>}
      </button>
      <div className="library-card-actions">
        <button type="button" className={`favorite-button ${favorite ? 'active' : ''}`} onClick={() => onToggleFavorite(exercise.id)} aria-label={favorite ? `取消收藏${exercise.name}` : `收藏${exercise.name}`}>{favorite ? '★' : '☆'}</button>
        <button type="button" className={selected ? 'select-exercise active' : 'select-exercise'} onClick={() => toggleSelected(exercise.id)} aria-pressed={selected}>{selected ? '已选' : '选择'}</button>
        <button type="button" className="quick-add-exercise" onClick={() => onAdd([exercise])}>加入</button>
      </div>
    </article>
  }

  return createPortal(<div className="library-backdrop" role="presentation">
    <section className="exercise-library" role="dialog" aria-modal="true" aria-label="从动作数据库添加动作">
      {detail ? <div className="library-detail">
        <header className="library-detail-header">
          <button type="button" className="detail-back" onClick={() => setDetailId(null)}><Icon name="chevron" size={18} />返回动作库</button>
          <button type="button" className={`favorite-button ${favoriteIdSet.has(detail.id) ? 'active' : ''}`} onClick={() => onToggleFavorite(detail.id)} aria-label={favoriteIdSet.has(detail.id) ? `取消收藏${detail.name}` : `收藏${detail.name}`}>{favoriteIdSet.has(detail.id) ? '★' : '☆'}</button>
        </header>
        <div className="library-detail-hero"><p className="eyebrow">{detail.category} · {detail.difficulty}</p><h2>{detail.name}</h2><p>{detail.aliases.length ? `别名：${detail.aliases.join('、')}` : '标准动作名称'}</p></div>
        <div className="detail-facts">
          <div><small>主要肌群</small><strong>{detail.primaryMuscles.join('、')}</strong></div>
          <div><small>次要肌群</small><strong>{detail.secondaryMuscles.join('、') || '—'}</strong></div>
          <div><small>训练部位</small><strong>{detail.bodyParts.join('、')}</strong></div>
          <div><small>器械</small><strong>{detail.equipment.join('、')}</strong></div>
          <div><small>动作模式</small><strong>{detail.movementPatterns.join('、')}</strong></div>
          <div><small>默认处方</small><strong>{prescriptionLabel(detail)} · RIR {detail.defaultPrescription.rir}</strong></div>
        </div>
        <div className="detail-section"><h3>训练效果</h3><ul>{detail.effects.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div className="detail-section"><h3>怎么做</h3><ol>{detail.steps.map((item) => <li key={item}>{item}</li>)}</ol></div>
        <div className="detail-grid">
          <div className="detail-section"><h3>动作提示</h3><ul>{detail.cues.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <div className="detail-section"><h3>常见错误</h3><ul>{detail.commonMistakes.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </div>
        <div className="notice danger"><Icon name="warning" /><div><strong>安全提醒</strong>{detail.safetyNotes.map((item) => <p key={item}>{item}</p>)}</div></div>
        {(detail.regressions.length > 0 || detail.progressions.length > 0) && <div className="exercise-relations">
          {detail.regressions.length > 0 && <div><small>更容易的退阶</small><span>{detail.regressions.map((id) => <button type="button" key={id} onClick={() => setDetailId(id)}>{findDatabaseExercise(id)?.name ?? id}</button>)}</span></div>}
          {detail.progressions.length > 0 && <div><small>下一步进阶</small><span>{detail.progressions.map((id) => <button type="button" key={id} onClick={() => setDetailId(id)}>{findDatabaseExercise(id)?.name ?? id}</button>)}</span></div>}
        </div>}
        <BilibiliTutorialPanel exerciseName={detail.name} tutorial={tutorials[detail.id]} onSave={(tutorial) => onSaveTutorial(detail.id, tutorial)} />
        <div className="library-detail-actions"><button type="button" className="button secondary" onClick={() => { toggleSelected(detail.id); setDetailId(null) }}>{selectedIds.includes(detail.id) ? '取消选择' : '加入待选'}</button><button type="button" className="button primary" onClick={() => onAdd([detail])}>加入计划</button></div>
      </div> : <>
        <header className="library-header"><div><p className="eyebrow">{databaseExercises.length} 个家庭训练动作</p><h2>动作数据库</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="关闭动作数据库"><Icon name="close" /></button></header>
        <div className="library-search-sticky">
          <label className="library-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜动作、肌群、部位、效果或器械" aria-label="搜索动作数据库" />{query && <button type="button" onClick={() => setQuery('')} aria-label="清空搜索"><Icon name="close" size={15} /></button>}</label>
          <details className="library-filter-details">
            <summary><span><strong>详细分类搜索</strong><small>部位、分类、器械、难度和模式</small></span><span>{activeFilterCount > 0 && <em>{activeFilterCount} 项</em>}<Icon name="chevron" size={16} /></span></summary>
            <div className="library-filter-panel">
              <div className="library-body-filters" aria-label="按训练部位筛选"><button type="button" className={!filters.bodyPart ? 'active' : ''} onClick={() => setFilter('bodyPart', undefined)}>全部</button>{BODY_PARTS.map((item) => <button type="button" className={filters.bodyPart === item ? 'active' : ''} key={item} onClick={() => setFilter('bodyPart', filters.bodyPart === item ? undefined : item)}>{item}</button>)}</div>
              <div className="library-select-filters">
                <select value={filters.category ?? ''} onChange={(event) => setFilter('category', event.target.value)} aria-label="按动作分类筛选"><option value="">全部分类</option>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
                <select value={filters.equipment ?? ''} onChange={(event) => setFilter('equipment', event.target.value)} aria-label="按器械筛选"><option value="">全部器械</option>{EQUIPMENT.map((item) => <option key={item}>{item}</option>)}</select>
                <select value={filters.difficulty ?? ''} onChange={(event) => setFilter('difficulty', event.target.value as ExerciseDifficulty | undefined)} aria-label="按难度筛选"><option value="">全部难度</option>{DIFFICULTIES.map((item) => <option key={item}>{item}</option>)}</select>
                <select value={filters.movementPattern ?? ''} onChange={(event) => setFilter('movementPattern', event.target.value)} aria-label="按动作模式筛选"><option value="">全部模式</option>{MOVEMENT_PATTERNS.map((item) => <option key={item}>{item}</option>)}</select>
              </div>
              <div className="library-filter-summary"><button type="button" className={filters.favoritesOnly ? 'active' : ''} onClick={() => setFilter('favoritesOnly', !filters.favoritesOnly)}>★ 仅看收藏</button><span>{results.length} 个结果</span>{hasFilters && <button type="button" onClick={() => setFilters({})}>清除筛选</button>}</div>
            </div>
          </details>
        </div>
        <div className="library-content" aria-busy={query !== deferredQuery}>
          {!query && !hasFilters && recentExercises.length > 0 && <section className="recent-exercises"><div className="library-section-title"><strong>最近使用</strong><small>左右滑动查看 {recentExercises.length} 个动作</small></div><div className="recent-exercise-track" aria-label="最近使用动作，左右滑动查看更多" tabIndex={0}>{recentExercises.map((exercise) => renderCard(exercise, true))}</div></section>}
          <section><div className="library-section-title"><strong>{query || hasFilters ? '搜索结果' : '全部动作'}</strong><small>支持多关键词同时匹配</small></div>{results.length ? <div className="library-results">{results.map((exercise) => renderCard(exercise))}</div> : <div className="library-empty"><span>没有找到匹配动作</span><p>试试减少关键词，或清除一个筛选条件。</p></div>}</section>
        </div>
        {selectedIds.length > 0 && <div className="library-selection-bar"><span><strong>{selectedIds.length}</strong> 个动作已选择</span><button type="button" className="button primary" onClick={addSelected}>一次加入计划</button></div>}
      </>}
    </section>
  </div>, document.body)
}
