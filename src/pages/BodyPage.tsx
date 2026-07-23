import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { MiniChart } from '../components/MiniChart'
import { daysBetween, formatChineseDate, toLocalISODate } from '../lib/date'
import { getWeeklyWeightAverages } from '../lib/stats'
import { upsertBodyRecord } from '../lib/storage'
import type { AppData, BodyMeasurements, BodyRecord } from '../types'

const measurementFields: { key: keyof BodyMeasurements; label: string }[] = [
  { key: 'chest', label: '胸围' }, { key: 'waist', label: '腰围' }, { key: 'hips', label: '臀围' },
  { key: 'upperArmLeft', label: '左上臂' }, { key: 'upperArmRight', label: '右上臂' },
  { key: 'thighLeft', label: '左大腿' }, { key: 'thighRight', label: '右大腿' },
  { key: 'calfLeft', label: '左小腿' }, { key: 'calfRight', label: '右小腿' },
]

const makeForm = (data: AppData): Omit<BodyRecord, 'id'> => {
  const date = toLocalISODate()
  const existing = data.bodyRecords.find((item) => item.date === date)
  return existing ? { ...existing } : { date, weight: undefined, note: '' }
}

export function BodyPage({ data, setData }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>> }) {
  const [form, setForm] = useState(() => makeForm(data))
  const [showMeasurements, setShowMeasurements] = useState(false)
  const [message, setMessage] = useState('')
  const weekly = useMemo(() => getWeeklyWeightAverages(data.bodyRecords, data.settings.weekStartsOn), [data.bodyRecords, data.settings.weekStartsOn])
  const recordedWeights = [...data.bodyRecords]
    .filter((item): item is BodyRecord & { weight: number } => typeof item.weight === 'number')
    .sort((a, b) => a.date.localeCompare(b.date))
  const latestWeight = recordedWeights.at(-1)?.weight ?? null
  const baselineWeight = data.profile.baselineWeight ?? recordedWeights[0]?.weight ?? null
  const goalWeight = data.profile.goalWeight ?? null
  const weightChange = latestWeight !== null && baselineWeight !== null ? latestWeight - baselineWeight : null
  const goalProgress = latestWeight !== null && baselineWeight !== null && goalWeight !== null
    ? Math.max(5, Math.min(100, ((latestWeight - baselineWeight) / (goalWeight - baselineWeight || 1)) * 100))
    : 5
  const circumferenceRecords = data.bodyRecords.filter((item) => measurementFields.some((field) => item[field.key] !== undefined))
  const latestCircumference = circumferenceRecords[0]
  const circumferenceDue = !latestCircumference || daysBetween(latestCircumference.date, toLocalISODate()) >= 28

  const updateNumeric = (key: 'weight' | keyof BodyMeasurements, raw: string) => setForm((current) => ({ ...current, [key]: raw === '' ? undefined : Number(raw) }))

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    const hasMeasurement = form.weight !== undefined || measurementFields.some((field) => form[field.key] !== undefined)
    if (!hasMeasurement) { setMessage('请至少填写体重或一项围度'); return }
    const record: BodyRecord = { ...form, id: `body_${form.date}` }
    setData((current) => upsertBodyRecord(
      form.weight !== undefined && current.profile.baselineWeight === undefined
        ? { ...current, profile: { ...current.profile, baselineWeight: form.weight } }
        : current,
      record,
    ))
    setMessage('身体数据已保存')
  }

  return <main className="page">
    <header className="page-header"><div><p className="eyebrow">{goalWeight !== null ? `个人目标 · ${goalWeight} kg` : '本地记录 · 可随时导出'}</p><h1>身体</h1></div><span className="header-icon"><Icon name="body" /></span></header>
    <section className="weight-hero">
      <div><small>最近体重</small><p><strong>{latestWeight !== null ? latestWeight.toFixed(1) : '—'}</strong>{latestWeight !== null && <span>kg</span>}</p><em className={weightChange !== null && weightChange >= 0 ? 'positive' : ''}>{weightChange === null ? '记录首次体重后建立起点' : `${weightChange >= 0 ? '+' : ''}${weightChange.toFixed(1)} kg 相对起点`}</em></div>
      <div className="goal-meter"><span style={{ height: `${goalProgress}%` }} /><small>{goalWeight !== null ? <>目标<br />{goalWeight} kg</> : <>尚未设置<br />目标体重</>}</small></div>
    </section>
    {circumferenceDue && <div className="notice recovery-reduce"><Icon name="calendar" /><div><strong>该测围度了</strong><p>{latestCircumference ? '距离上次围度记录已满 4 周。' : '建立第一份围度记录，之后每 4 周提醒一次。'}</p></div></div>}
    <section className="card">
      <div className="section-heading"><div><p className="eyebrow">WEEKLY AVERAGE</p><h2>体重周平均</h2></div><span>{weekly.at(-1)?.count ?? 0} 次记录</span></div>
      <MiniChart points={weekly.slice(-8).map((item) => ({ label: item.week.slice(5).replace('-', '/'), value: item.average }))} suffix=" kg" emptyText="每周记录 3–4 次晨起空腹体重后显示趋势" />
      {weekly.length >= 2 && weekly.at(-1)!.average <= weekly.at(-2)!.average && <p className="chart-caption advice">若连续两周平均值不升，每天增加一份主食或一个加餐。</p>}
    </section>
    <form className="card form-card" onSubmit={save}>
      <div className="section-heading"><div><p className="eyebrow">NEW ENTRY</p><h2>记录身体数据</h2></div></div>
      <div className="system-date-row"><span><Icon name="calendar" size={16} />系统日期</span><strong>{formatChineseDate(form.date, true)}</strong></div>
      <label>晨起空腹体重<div className="input-unit"><input type="number" inputMode="decimal" min="30" max="300" step="0.1" value={form.weight ?? ''} placeholder="例如 65.0" onChange={(event) => updateNumeric('weight', event.target.value)} /><span>kg</span></div></label>
      <button type="button" className="warmup-toggle inner" onClick={() => setShowMeasurements((value) => !value)}><span><Icon name="body" />围度（建议每 4 周）</span><Icon name="chevron" className={showMeasurements ? 'rotate' : ''} /></button>
      {showMeasurements && <div className="form-grid three measurement-grid">{measurementFields.map((field) => <label key={field.key}>{field.label}<div className="input-unit"><input type="number" inputMode="decimal" min="10" max="200" step="0.1" value={form[field.key] ?? ''} placeholder={String(data.profile[field.key] ?? '')} onChange={(event) => updateNumeric(field.key, event.target.value)} /><span>cm</span></div></label>)}</div>}
      <label>备注（可选）<textarea value={form.note} placeholder="测量条件、近期饮食变化……" onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></label>
      {message && <p className="form-message">{message}</p>}
      <button className="button primary full" type="submit">保存身体数据</button>
    </form>
    <section className="section-block">
      <div className="section-heading"><div><p className="eyebrow">RECENT</p><h2>最近记录</h2></div></div>
      {data.bodyRecords.length === 0 ? <div className="empty-inline">还没有身体数据记录</div> : <div className="data-list">{data.bodyRecords.slice(0, 8).map((record) => <div key={record.id}><span><strong>{formatChineseDate(record.date)}</strong><small>{measurementFields.filter((field) => record[field.key] !== undefined).length ? '含围度' : '仅体重'}</small></span><strong>{record.weight ? `${record.weight.toFixed(1)} kg` : '围度记录'}</strong></div>)}</div>}
    </section>
  </main>
}
