import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from './Icon'

interface Props {
  open: boolean
  eyebrow?: string
  title: string
  message: string
  details?: string[]
  icon?: IconName
  confirmLabel: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  eyebrow = '请确认操作',
  title,
  message,
  details = [],
  icon = 'warning',
  confirmLabel,
  cancelLabel = '取消',
  variant = 'danger',
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onKeyDown)
    document.body.classList.add('confirm-open')
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('confirm-open')
    }
  }, [open, onCancel])

  if (!open) return null
  return createPortal(<div className="confirm-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
    <section className={`confirm-dialog ${variant}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <div className="confirm-handle" />
      <div className="confirm-icon"><Icon name={icon} size={26} /></div>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-message" className="confirm-message">{message}</p>
      {details.length > 0 && <ul className="confirm-details">{details.map((item) => <li key={item}><Icon name="check" size={14} />{item}</li>)}</ul>}
      <div className="confirm-actions">
        <button className="button secondary" onClick={onCancel}>{cancelLabel}</button>
        <button className={`button confirm-action ${variant}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </section>
  </div>, document.body)
}
