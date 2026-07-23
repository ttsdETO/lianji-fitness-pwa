import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { WarmupExercise } from '../types'
import { Icon } from './Icon'

export function WarmupDrawer({ item, onClose }: { item: WarmupExercise | null; onClose: () => void }) {
  useEffect(() => {
    if (!item) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('drawer-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('drawer-open')
    }
  }, [item, onClose])

  if (!item) return null
  const isStretch = item.phase === 'stretch'
  return createPortal(<div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`exercise-drawer warmup-drawer ${isStretch ? 'stretch-drawer' : ''}`} role="dialog" aria-modal="true" aria-label={`${item.name}${isStretch ? '拉伸' : '热身'}详解`}>
      <div className="drawer-topbar">
        <div className="drawer-handle" />
        <button className="icon-button drawer-close" onClick={onClose} aria-label="关闭"><Icon name="close" /></button>
      </div>
      <div className="exercise-visual warmup-visual" aria-hidden="true">
        <span>{isStretch ? '伸' : '热'}</span>
        <div><strong>{isStretch ? '拉伸' : '热身'}</strong><small>{item.purpose}</small></div>
      </div>
      <p className="eyebrow">{isStretch ? '拉伸详解' : '热身详解'}</p>
      <h2>{item.name}</h2>
      <p className="drawer-target">建议完成 · {item.dose}{item.optional ? ' · 可选' : ''}</p>
      <div className="notice recovery-normal"><Icon name="spark" /><div><strong>为什么做</strong><p>{item.purpose}</p></div></div>
      <div className="detail-section">
        <h3>怎么做</h3>
        <ol>{item.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      </div>
      <div className="detail-grid">
        <div className="detail-section"><h3>关键提示</h3><ul>{item.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></div>
        <div className="detail-section"><h3>常见错误</h3><ul>{item.mistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}</ul></div>
      </div>
      <div className="notice warning"><Icon name="warning" /><div><strong>以舒适为准</strong><p>{isStretch ? '牵拉感控制在 3–4/10，不疼、不憋气、不弹振；出现麻木、锐痛或关节夹痛时停止。' : '热身不追求疲劳。出现关节刺痛、锐痛或明显不适时停止该动作。'}</p></div></div>
      <div className="drawer-action-bar"><button className="button primary full" onClick={onClose}>我知道了</button></div>
    </section>
  </div>, document.body)
}
