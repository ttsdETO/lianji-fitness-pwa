import { useState } from 'react'
import { Icon } from '../components/Icon'
import { formatSleepDuration, normalizeClockMinutes, SleepDurationDial } from '../components/SleepDurationDial'
import { addDays, formatChineseDate, toLocalISODate } from '../lib/date'
import { getRecoveryAdvice } from '../lib/recovery'
import { upsertRecoveryRecord } from '../lib/storage'
import type { AppData, RecoveryRecord } from '../types'

const makeForm = (data: AppData): Omit<RecoveryRecord, 'id'> => {
  const date = toLocalISODate()
  const existing = data.recoveryRecords.find((item) => item.date === date)
  if (existing) {
    const bedtimeMinutes = existing.bedtimeMinutes ?? 23 * 60
    const wakeTimeMinutes = existing.wakeTimeMinutes ?? normalizeClockMinutes(bedtimeMinutes + existing.sleepHours * 60)
    return { ...existing, bedtimeMinutes, wakeTimeMinutes }
  }
  return { date, sleepHours: 7, bedtimeMinutes: 23 * 60, wakeTimeMinutes: 6 * 60, fatigue: 4, soreness: 3, jointPain: false, painArea: '', note: '' }
}

export function RecoveryPage({ data, setData }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>> }) {
  const [form, setForm] = useState(() => makeForm(data))
  const [saved, setSaved] = useState(false)
  const previewRecords: RecoveryRecord[] = [{ ...form, id: `recovery_${form.date}` }, ...data.recoveryRecords.filter((item) => item.date !== form.date)]
  const advice = getRecoveryAdvice(form.date, previewRecords)
  const yesterday = data.recoveryRecords.find((item) => item.date === addDays(form.date, -1))

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    const record: RecoveryRecord = { ...form, id: `recovery_${form.date}` }
    setData((current) => upsertRecoveryRecord(current, record))
    setSaved(true)
  }

  return <main className="page">
    <header className="page-header"><div><p className="eyebrow">睡得更好 · 练得更稳</p><h1>恢复</h1></div><span className="header-icon"><Icon name="recovery" /></span></header>
    <div className={`recovery-score-card ${advice.level}`}>
      <span className="recovery-score-icon"><Icon name={advice.level === 'normal' ? 'spark' : advice.level === 'reduce' ? 'moon' : 'warning'} size={28} /></span>
      <div><p className="eyebrow">今日建议</p><h2>{advice.title}</h2><p>{advice.message}</p></div>
    </div>
    {yesterday && yesterday.sleepHours < 6 && form.sleepHours < 6 && <div className="sleep-chain"><Icon name="moon" /><span>昨晚 {formatSleepDuration(form.sleepHours)}</span><i /><span>前晚 {formatSleepDuration(yesterday.sleepHours)}</span></div>}
    <form className="card recovery-form" onSubmit={save}>
      <div className="system-date-row"><span><Icon name="calendar" size={16} />系统日期</span><strong>{formatChineseDate(form.date, true)}</strong></div>
      <SleepDurationDial
        bedtimeMinutes={form.bedtimeMinutes ?? 23 * 60}
        wakeTimeMinutes={form.wakeTimeMinutes ?? 6 * 60}
        onChange={(sleep) => { setForm((current) => ({ ...current, ...sleep })); setSaved(false) }}
      />
      <label className="range-label"><span>疲劳程度 <strong>{form.fatigue}</strong><small>1 精神充沛 · 10 非常疲劳</small></span><input type="range" min="1" max="10" value={form.fatigue} onChange={(event) => { setForm((current) => ({ ...current, fatigue: Number(event.target.value) })); setSaved(false) }} /></label>
      <label className="range-label"><span>肌肉酸痛 <strong>{form.soreness}</strong><small>1 几乎没有 · 10 严重影响活动</small></span><input type="range" min="1" max="10" value={form.soreness} onChange={(event) => { setForm((current) => ({ ...current, soreness: Number(event.target.value) })); setSaved(false) }} /></label>
      <button type="button" className={`joint-toggle ${form.jointPain ? 'active' : ''}`} onClick={() => { setForm((current) => ({ ...current, jointPain: !current.jointPain })); setSaved(false) }}><span><Icon name="warning" /><span><strong>存在关节疼痛</strong><small>刺痛、锐痛或明显不适</small></span></span><i><Icon name="check" size={16} /></i></button>
      {form.jointPain && <label>疼痛部位或相关动作<input autoFocus value={form.painArea} placeholder="例如：右膝、屈体俯卧撑时右肩" onChange={(event) => setForm((current) => ({ ...current, painArea: event.target.value }))} /></label>}
      <label>恢复备注（可选）<textarea value={form.note} placeholder="精神状态、压力、疼痛变化……" onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></label>
      {saved && <p className="form-message success"><Icon name="check" size={17} />今日恢复状态已保存</p>}
      <button className="button primary full" type="submit">保存恢复打卡</button>
    </form>
    <section className="section-block">
      <div className="section-heading"><div><p className="eyebrow">LAST 7</p><h2>近期恢复</h2></div></div>
      {data.recoveryRecords.length === 0 ? <div className="empty-inline">还没有恢复记录</div> : <div className="recovery-history">{data.recoveryRecords.slice(0, 7).map((record) => <div className="recovery-history-row" key={record.id}><span><strong>{formatChineseDate(record.date)}</strong><small>{record.jointPain ? `${record.painArea || '关节'}疼痛` : `疲劳 ${record.fatigue} · 酸痛 ${record.soreness}`}</small></span><span className={record.sleepHours < 6 ? 'low' : ''}><Icon name="moon" size={16} />{formatSleepDuration(record.sleepHours)}</span></div>)}</div>}
    </section>
  </main>
}
