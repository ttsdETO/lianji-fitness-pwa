import { useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { DateInput } from '../components/DateInput'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ExerciseDrawer } from '../components/ExerciseDrawer'
import { ExerciseLibrary } from '../components/ExerciseLibrary'
import { ExerciseRelationsDrawer } from '../components/ExerciseRelationsDrawer'
import type { DatabaseExercise } from '../data/exerciseDatabase'
import { clearCoachStorage } from '../lib/coach'
import { getWeekdayName } from '../lib/date'
import { createDefaultWeeklyPlan, createPlanExerciseFromDatabase, estimatePlanMinutes, movePlanExercise, replacePlanExerciseFromDatabase, resolveTrainingDay, WEEKDAYS } from '../lib/plan'
import { createDefaultData, exportBackup, importBackup } from '../lib/storage'
import type { AppData, ExerciseTutorial, PlanExercise, ThemeMode, WeeklyPlanDay } from '../types'

interface Props {
  data: AppData
  setData: React.Dispatch<React.SetStateAction<AppData>>
  canInstall: boolean
  isStandalone: boolean
  onInstall: () => void
}

export function SettingsPage({ data, setData, canInstall, isStandalone, onInstall }: Props) {
  const [equipmentInput, setEquipmentInput] = useState('')
  const [message, setMessage] = useState('')
  const [selectedWeekday, setSelectedWeekday] = useState<number>(new Date().getDay())
  const [showPlanResetConfirm, setShowPlanResetConfirm] = useState(false)
  const [exerciseLibraryOpen, setExerciseLibraryOpen] = useState(false)
  const [detailPlanExerciseId, setDetailPlanExerciseId] = useState<string | null>(null)
  const [relationPlanExerciseId, setRelationPlanExerciseId] = useState<string | null>(null)
  const [removedExercise, setRemovedExercise] = useState<{ weekday: number; index: number; exercise: PlanExercise } | null>(null)
  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const updateProfile = <K extends keyof AppData['profile']>(key: K, value: AppData['profile'][K]) => setData((current) => ({ ...current, profile: { ...current.profile, [key]: value } }))
  const updateOptionalNumber = (key: 'height' | 'goalWeight', raw: string) => updateProfile(key, raw === '' ? undefined : Number(raw))
  const updateTheme = (theme: ThemeMode) => setData((current) => ({ ...current, settings: { ...current.settings, theme } }))

  const updateWeeklyPlan = (updater: (plan: WeeklyPlanDay[]) => WeeklyPlanDay[]) => {
    setData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        weeklyPlan: updater(current.settings.weeklyPlan),
      },
    }))
  }

  const updatePlanDay = (weekday: number, updater: (day: WeeklyPlanDay) => WeeklyPlanDay) => updateWeeklyPlan((plan) => plan.map((day) => day.weekday === weekday ? updater(day) : day))

  const updatePlanExercise = (exerciseId: string, patch: Partial<PlanExercise>) => updatePlanDay(selectedWeekday, (day) => ({
    ...day,
    exercises: day.exercises.map((item) => item.id === exerciseId ? { ...item, ...patch } : item),
  }))

  const openExerciseLibrary = () => setExerciseLibraryOpen(true)

  const addDatabaseExercises = (exercises: DatabaseExercise[]) => {
    if (!exercises.length) return
    setData((current) => {
      const recentExerciseIds = [...exercises.map((exercise) => exercise.id).reverse(), ...current.settings.recentExerciseIds]
        .filter((id, index, values) => values.indexOf(id) === index)
        .slice(0, 16)
      const weeklyPlan = current.settings.weeklyPlan.map((day) => {
        if (day.weekday !== selectedWeekday) return day
        const stamp = Date.now()
        const additions = exercises.map((exercise, index) => createPlanExerciseFromDatabase(exercise, `plan-${selectedWeekday}-${exercise.id}-${stamp}-${index}`))
        return { ...day, enabled: true, exercises: [...day.exercises, ...additions].map((item, order) => ({ ...item, order })) }
      })
      return { ...current, settings: { ...current.settings, weeklyPlan, recentExerciseIds } }
    })
    setExerciseLibraryOpen(false)
  }

  const saveExerciseTutorial = (exerciseId: string, tutorial: ExerciseTutorial | null) => setData((current) => ({
    ...current,
    settings: { ...current.settings, exerciseTutorials: { ...current.settings.exerciseTutorials, [exerciseId]: tutorial } },
  }))

  const replaceWithRelation = (databaseExercise: DatabaseExercise) => {
    if (!relationPlanExerciseId) return
    setData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        recentExerciseIds: [databaseExercise.id, ...current.settings.recentExerciseIds.filter((id) => id !== databaseExercise.id)].slice(0, 16),
        weeklyPlan: current.settings.weeklyPlan.map((day) => day.weekday === selectedWeekday
          ? { ...day, exercises: day.exercises.map((item) => item.id === relationPlanExerciseId ? replacePlanExerciseFromDatabase(item, databaseExercise) : item) }
          : day),
      },
    }))
    setRelationPlanExerciseId(null)
  }

  const toggleFavorite = (exerciseId: string) => setData((current) => ({
    ...current,
    settings: {
      ...current.settings,
      favoriteExerciseIds: current.settings.favoriteExerciseIds.includes(exerciseId)
        ? current.settings.favoriteExerciseIds.filter((id) => id !== exerciseId)
        : [...current.settings.favoriteExerciseIds, exerciseId],
    },
  }))

  const removePlanExercise = (exercise: PlanExercise, index: number) => {
    setRemovedExercise({ weekday: selectedWeekday, index, exercise })
    updatePlanDay(selectedWeekday, (day) => ({ ...day, exercises: day.exercises.filter((item) => item.id !== exercise.id).map((item, order) => ({ ...item, order })) }))
  }

  const undoRemoveExercise = () => {
    if (!removedExercise) return
    updatePlanDay(removedExercise.weekday, (day) => {
      const exercises = [...day.exercises]
      exercises.splice(Math.min(removedExercise.index, exercises.length), 0, removedExercise.exercise)
      return { ...day, exercises: exercises.map((item, order) => ({ ...item, order })) }
    })
    setRemovedExercise(null)
  }

  const duplicatePlanExercise = (exercise: PlanExercise, index: number) => updatePlanDay(selectedWeekday, (day) => {
    const exercises = [...day.exercises]
    exercises.splice(index + 1, 0, { ...exercise, id: `${exercise.id}-copy-${Date.now()}` })
    return { ...day, exercises: exercises.map((item, order) => ({ ...item, order })) }
  })

  const copyPlanDay = (sourceWeekday: number) => {
    const source = data.settings.weeklyPlan.find((day) => day.weekday === sourceWeekday)
    if (!source) return
    updatePlanDay(selectedWeekday, (day) => ({
      ...day,
      enabled: source.enabled,
      title: source.title,
      focus: source.focus,
      exercises: source.exercises.map((item) => ({ ...item })),
    }))
  }

  const selectedDay = data.settings.weeklyPlan.find((day) => day.weekday === selectedWeekday) ?? data.settings.weeklyPlan[0]
  const detailPlanExercise = resolveTrainingDay(data.settings.weeklyPlan, selectedWeekday)?.exercises.find((exercise) => exercise.id === detailPlanExerciseId) ?? null

  const addEquipment = () => {
    const value = equipmentInput.trim()
    if (!value || data.profile.equipment.includes(value)) return
    updateProfile('equipment', [...data.profile.equipment, value])
    setEquipmentInput('')
  }

  const exportData = () => {
    if (!window.confirm('备份文件会包含你在本机保存的训练、身体、恢复和个人资料。请只保存在可信设备中，确认继续导出吗？')) return
    const blob = new Blob([exportBackup(data)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `练迹备份_${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(link.href)
    setMessage('备份文件已导出')
  }

  const importData = async (file?: File) => {
    if (!file) return
    try {
      if (!file.name.toLowerCase().endsWith('.json')) throw new Error('请选择 JSON 备份文件')
      if (file.size > 5 * 1024 * 1024) throw new Error('备份文件不能超过 5 MB')
      const imported = importBackup(await file.text())
      if (!window.confirm('导入会替换当前设备中的全部训练数据，确认继续吗？')) return
      setData(imported)
      setMessage('备份已成功导入')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入失败')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const reset = () => {
    clearCoachStorage()
    setData(createDefaultData())
    setClearStep(0)
    setMessage('本地数据与 AI Key 已清空，训练计划已恢复默认')
  }

  return <main className="page settings-page">
    <header className="page-header"><div><p className="eyebrow">只存本机 · 无需账号</p><h1>设置</h1></div><span className="header-icon"><Icon name="settings" /></span></header>
    <section className="card install-card">
      <span className="app-mark"><img src="/icon.svg" alt="" /></span>
      <div><h2>{isStandalone ? '已作为应用运行' : '安装到手机桌面'}</h2><p>{isStandalone ? '离线也可以打开，数据仍只保存在本机。' : '像普通 App 一样全屏打开，并支持离线使用。'}</p></div>
      {!isStandalone && <button className="button small primary" onClick={onInstall} disabled={!canInstall}>{canInstall ? '安装' : '查看方法'}</button>}
    </section>
    <section className="card form-card">
      <div className="section-heading"><div><p className="eyebrow">PROFILE</p><h2>个人资料</h2></div></div>
      <div className="form-grid two">
        <label>称呼<input value={data.profile.name} onChange={(event) => updateProfile('name', event.target.value)} /></label>
        <label>出生日期<DateInput value={data.profile.birthDate} max={new Date().toISOString().slice(0, 10)} ariaLabel="出生日期" onChange={(value) => updateProfile('birthDate', value)} /></label>
        <label>身高（可选）<div className="input-unit"><input type="number" min="50" max="250" step="0.1" value={data.profile.height ?? ''} placeholder="留空" onChange={(event) => updateOptionalNumber('height', event.target.value)} /><span>cm</span></div></label>
        <label>目标体重（可选）<div className="input-unit"><input type="number" min="30" max="300" step="0.1" value={data.profile.goalWeight ?? ''} placeholder="留空" onChange={(event) => updateOptionalNumber('goalWeight', event.target.value)} /><span>kg</span></div></label>
      </div>
      <label>现有器械</label>
      <div className="equipment-chips">{data.profile.equipment.map((item) => <span key={item}>{item}<button onClick={() => updateProfile('equipment', data.profile.equipment.filter((value) => value !== item))} aria-label={`删除${item}`}><Icon name="close" size={13} /></button></span>)}</div>
      <div className="inline-add"><input value={equipmentInput} placeholder="添加器械" onChange={(event) => setEquipmentInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addEquipment() } }} /><button className="button secondary small" onClick={addEquipment}>添加</button></div>
    </section>
    <section className="card form-card">
      <div className="section-heading"><div><p className="eyebrow">PREFERENCES</p><h2>显示与日历</h2></div></div>
      <label>外观</label>
      <div className="segmented">{([['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']] as [ThemeMode, string][]).map(([value, label]) => <button key={value} className={data.settings.theme === value ? 'active' : ''} onClick={() => updateTheme(value)}>{label}</button>)}</div>
      <label>训练周起始日</label>
      <div className="segmented"><button className={data.settings.weekStartsOn === 1 ? 'active' : ''} onClick={() => setData((current) => ({ ...current, settings: { ...current.settings, weekStartsOn: 1 } }))}>周一</button><button className={data.settings.weekStartsOn === 0 ? 'active' : ''} onClick={() => setData((current) => ({ ...current, settings: { ...current.settings, weekStartsOn: 0 } }))}>周日</button></div>
    </section>
    <section className="card plan-settings">
      <div className="section-heading"><div><p className="eyebrow">CUSTOM PLAN</p><h2>调整训练计划</h2></div></div>
      <p className="section-intro">按周一至周日安排训练。新加动作会同步到尚未结束的训练草稿；已完成的历史记录不会改变。</p>
      <div className="week-plan-calendar" aria-label="每周训练日历">
        {WEEKDAYS.map((weekday) => {
          const day = data.settings.weeklyPlan.find((item) => item.weekday === weekday)
          return <button type="button" key={weekday} className={selectedWeekday === weekday ? 'active' : ''} onClick={() => setSelectedWeekday(weekday)}>
            <small>{getWeekdayName(weekday)}</small>
            <strong>{day?.enabled ? day.title : '休息'}</strong>
            <span>{day?.enabled ? `${day.exercises.length} 项` : '未安排'}</span>
          </button>
        })}
      </div>
      {selectedDay && <details className="plan-day-details" key={selectedDay.weekday}>
        <summary><span><strong>{getWeekdayName(selectedDay.weekday)} · {selectedDay.enabled ? selectedDay.title : '休息日'}</strong><small>{selectedDay.enabled ? `${selectedDay.exercises.length} 个动作 · 点击展开自定义` : '点击展开设置'}</small></span><Icon name="chevron" /></summary>
        <div className="plan-day-editor">
        <div className="plan-day-toolbar">
          <div><p className="eyebrow">{getWeekdayName(selectedDay.weekday)}</p><h3>{selectedDay.enabled ? selectedDay.title : '休息日'}</h3></div>
          <button type="button" className={`day-enable-toggle ${selectedDay.enabled ? 'active' : ''}`} role="switch" aria-checked={selectedDay.enabled} onClick={() => updatePlanDay(selectedDay.weekday, (day) => ({ ...day, enabled: !day.enabled }))}>{selectedDay.enabled ? '训练日' : '休息日'}</button>
        </div>
        <div className="form-grid two plan-day-fields">
          <label>每日训练总名称<input value={selectedDay.title} onChange={(event) => updatePlanDay(selectedDay.weekday, (day) => ({ ...day, title: event.target.value }))} /></label>
          <label>训练重点<input value={selectedDay.focus} onChange={(event) => updatePlanDay(selectedDay.weekday, (day) => ({ ...day, focus: event.target.value }))} /></label>
        </div>
        <label className="copy-day-field">复制其他日内容<select value="" onChange={(event) => { if (event.target.value !== '') copyPlanDay(Number(event.target.value)) }}><option value="">选择要复制的日期…</option>{WEEKDAYS.filter((weekday) => weekday !== selectedDay.weekday).map((weekday) => <option key={weekday} value={weekday}>{getWeekdayName(weekday)}</option>)}</select></label>
        {!selectedDay.enabled && <div className="empty-inline">当前设为休息日；开启“训练日”即可编辑并同步到今日。</div>}
        {selectedDay.enabled && <div className="plan-exercise-list">
          <div className="plan-estimate"><span><strong>{selectedDay.exercises.length}</strong> 个动作 · <strong>{selectedDay.exercises.reduce((sum, item) => sum + item.sets, 0)}</strong> 组</span><span>预计约 {estimatePlanMinutes(selectedDay.exercises)} 分钟</span></div>
          {selectedDay.exercises.length === 0 && <div className="empty-inline">还没有动作。打开动作库，可按肌群、部位、效果和器械自由组合。</div>}
          {selectedDay.exercises.map((exercise, index) => <article className="plan-exercise-editor" key={exercise.id}>
            <header className="plan-exercise-editor-header">
              <span className="plan-exercise-index">{String(index + 1).padStart(2, '0')}</span>
              {exercise.exerciseId
                ? <div className="plan-exercise-name"><strong>{exercise.nameSnapshot ?? exercise.name}</strong><small>{exercise.databaseCategory ?? exercise.category} · {exercise.equipment}</small></div>
                : <label className="custom-exercise-name"><span>未关联动作库</span><input aria-label={`第${index + 1}项动作名称`} value={exercise.name} onChange={(event) => updatePlanExercise(exercise.id, { name: event.target.value, nameSnapshot: event.target.value })} /></label>}
              {exercise.exerciseId && <button type="button" className="plan-detail-button" onClick={() => setDetailPlanExerciseId(exercise.id)} aria-label={`查看${exercise.name}动作提示`}><Icon name="info" size={18} /></button>}
            </header>
            <div className="plan-exercise-summary">
              <span><strong>{exercise.sets}</strong> 组</span>
              <span><strong>{exercise.unit === '秒' ? exercise.timerSeconds ?? exercise.repsMin : `${exercise.repsMin}${exercise.repsMax !== exercise.repsMin ? `–${exercise.repsMax}` : ''}`}</strong> {exercise.unit}</span>
              <span>休息 <strong>{exercise.restSeconds}</strong> 秒</span>
              <span>RIR <strong>{exercise.rir ?? 2}</strong></span>
            </div>
            <div className="plan-card-actions">
              <button type="button" disabled={index === 0} onClick={() => updatePlanDay(selectedDay.weekday, (day) => ({ ...day, exercises: movePlanExercise(day.exercises, index, index - 1) }))} aria-label={`上移${exercise.name}`}>↑<span>上移</span></button>
              <button type="button" disabled={index === selectedDay.exercises.length - 1} onClick={() => updatePlanDay(selectedDay.weekday, (day) => ({ ...day, exercises: movePlanExercise(day.exercises, index, index + 1) }))} aria-label={`下移${exercise.name}`}>↓<span>下移</span></button>
              <button type="button" onClick={() => duplicatePlanExercise(exercise, index)} aria-label={`复制${exercise.name}`}>＋<span>复制</span></button>
              {exercise.exerciseId && <button type="button" onClick={() => setRelationPlanExerciseId(exercise.id)} aria-label={`查看${exercise.name}进退阶`}><Icon name="trend" size={14} /><span>进退阶</span></button>}
              <button type="button" className="remove" onClick={() => removePlanExercise(exercise, index)} aria-label={`删除${exercise.name}`}><Icon name="trash" size={14} /><span>删除</span></button>
            </div>
            <details className="plan-exercise-parameters">
              <summary aria-label={`编辑${exercise.name}参数`}><span>编辑训练参数与备注</span><Icon name="chevron" size={16} /></summary>
              <div className="plan-exercise-parameter-panel">
                <div className="form-grid two plan-exercise-main">
                  <label>器械或说明<input value={exercise.equipment} onChange={(event) => updatePlanExercise(exercise.id, { equipment: event.target.value })} /></label>
                  <label>记录方式<select value={exercise.unit} onChange={(event) => {
                    const unit = event.target.value === '秒' ? '秒' : '次'
                    updatePlanExercise(exercise.id, { unit, timerSeconds: unit === '秒' ? exercise.timerSeconds ?? exercise.repsMin : undefined })
                  }}><option value="次">按次数</option><option value="秒">按倒计时</option></select></label>
                </div>
                <div className={`exercise-parameter-grid ${exercise.unit === '秒' ? 'timed' : ''}`}>
                  <label>组数<input type="number" min="1" max="10" value={exercise.sets} onChange={(event) => updatePlanExercise(exercise.id, { sets: Number(event.target.value) })} /></label>
                  {exercise.unit === '秒'
                    ? <label>每组倒计时<input type="number" min="5" max="3600" step="5" value={exercise.timerSeconds ?? exercise.repsMin} onChange={(event) => updatePlanExercise(exercise.id, { timerSeconds: Number(event.target.value), repsMin: Number(event.target.value), repsMax: Number(event.target.value) })} /></label>
                    : <><label>最低次数<input type="number" min="1" max="999" value={exercise.repsMin} onChange={(event) => updatePlanExercise(exercise.id, { repsMin: Number(event.target.value) })} /></label><label>最高次数<input type="number" min="1" max="999" value={exercise.repsMax} onChange={(event) => updatePlanExercise(exercise.id, { repsMax: Number(event.target.value) })} /></label></>}
                  <label>组间休息秒<input type="number" min="0" max="600" step="15" value={exercise.restSeconds} onChange={(event) => updatePlanExercise(exercise.id, { restSeconds: Number(event.target.value) })} /></label>
                  <label>重量 kg<input type="number" min="0" max="999" step="0.5" value={exercise.weightKg ?? 0} onChange={(event) => updatePlanExercise(exercise.id, { weightKg: Math.max(0, Number(event.target.value)) })} /></label>
                  <label>目标 RIR<input type="number" min="0" max="10" value={exercise.rir ?? 2} onChange={(event) => updatePlanExercise(exercise.id, { rir: Number(event.target.value) })} /></label>
                  <label className="checkbox-field"><input type="checkbox" checked={exercise.perSide} onChange={(event) => updatePlanExercise(exercise.id, { perSide: event.target.checked })} />每侧分别完成</label>
                </div>
                <label className="plan-exercise-notes">个人备注<textarea value={exercise.notes ?? ''} placeholder="例如：最后一组减重，注意肩胛下沉" onChange={(event) => updatePlanExercise(exercise.id, { notes: event.target.value })} /></label>
              </div>
            </details>
          </article>)}
          <button type="button" className="button primary full add-plan-exercise" onClick={() => openExerciseLibrary()}><Icon name="plus" />从动作数据库添加</button>
        </div>}
        </div>
      </details>}
      {removedExercise && <div className="plan-undo" role="status"><span>已删除“{removedExercise.exercise.nameSnapshot ?? removedExercise.exercise.name}”</span><button type="button" onClick={undoRemoveExercise}>撤销</button></div>}
      <button className="text-button reset-plan" onClick={() => setShowPlanResetConfirm(true)}>恢复默认训练参数</button>
    </section>
    <section className="card data-card">
      <div className="section-heading"><div><p className="eyebrow">LOCAL DATA</p><h2>备份与数据</h2></div></div>
      <p>训练和身体数据只保存在当前浏览器。换手机或清除浏览器数据前，请先导出备份。</p>
      <div className="data-actions"><button className="button secondary" onClick={exportData}><Icon name="download" />导出 JSON</button><button className="button secondary" onClick={() => fileRef.current?.click()}><Icon name="upload" />导入 JSON</button></div>
      <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importData(event.target.files?.[0])} />
      {message && <p className="form-message">{message}</p>}
      <button className="danger-button" onClick={() => setClearStep(1)}><Icon name="trash" />清空本机全部数据</button>
    </section>
      <footer className="settings-footer"><strong>练迹 v1.2.0</strong><span>动作质量优先 · 保留余力 · 睡眠也是训练</span></footer>
    <ExerciseLibrary
      open={exerciseLibraryOpen}
      favoriteIds={data.settings.favoriteExerciseIds}
      recentIds={data.settings.recentExerciseIds}
      currentExerciseIds={selectedDay?.exercises.map((exercise) => exercise.exerciseId).filter((id): id is string => Boolean(id)) ?? []}
      tutorials={data.settings.exerciseTutorials}
      onToggleFavorite={toggleFavorite}
      onSaveTutorial={saveExerciseTutorial}
      onAdd={addDatabaseExercises}
      onClose={() => setExerciseLibraryOpen(false)}
    />
    <ExerciseRelationsDrawer
      open={Boolean(relationPlanExerciseId)}
      exerciseId={selectedDay?.exercises.find((exercise) => exercise.id === relationPlanExerciseId)?.exerciseId}
      onReplace={replaceWithRelation}
      onClose={() => setRelationPlanExerciseId(null)}
    />
    <ExerciseDrawer exercise={detailPlanExercise} onClose={() => setDetailPlanExerciseId(null)} />
    <ConfirmDialog
      open={showPlanResetConfirm}
      eyebrow="调整训练计划"
      title="恢复默认训练计划？"
      message="周一至周日安排、每日名称、自定义动作和全部训练参数都会恢复为内置计划。"
      details={['历史训练记录不会改变', '之后新开始的训练将使用默认计划']}
      icon="warning"
      confirmLabel="确认恢复"
      variant="warning"
      onCancel={() => setShowPlanResetConfirm(false)}
      onConfirm={() => {
        setData((current) => ({ ...current, settings: { ...current.settings, exerciseOverrides: {}, weeklyPlan: createDefaultWeeklyPlan() } }))
        setShowPlanResetConfirm(false)
      }}
    />
    <ConfirmDialog
      open={clearStep === 1}
      eyebrow="本机数据管理"
      title="准备清空全部数据？"
      message="这会删除当前浏览器中的训练、身体和恢复记录，同时恢复默认资料与计划设置。"
      details={['已导出的 JSON 备份不会被删除', '此操作不会影响其他设备']}
      icon="trash"
      confirmLabel="继续确认"
      variant="warning"
      onCancel={() => setClearStep(0)}
      onConfirm={() => setClearStep(2)}
    />
    <ConfirmDialog
      open={clearStep === 2}
      eyebrow="最后一次确认"
      title="清空后无法撤销"
      message="如果没有提前导出 JSON 备份，这些记录将无法恢复。"
      details={['全部训练记录', '身体与围度数据', '恢复打卡、自定义设置与 AI Key']}
      icon="warning"
      confirmLabel="确认清空"
      onCancel={() => setClearStep(0)}
      onConfirm={reset}
    />
  </main>
}
