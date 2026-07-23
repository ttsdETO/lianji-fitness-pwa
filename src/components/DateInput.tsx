import { Icon } from './Icon'

interface Props {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  ariaLabel?: string
}

const displayDate = (value: string) => {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${year} / ${month} / ${day}` : '请选择日期'
}

export function DateInput({ value, onChange, min, max, ariaLabel = '选择日期' }: Props) {
  return <span className="date-input-shell">
    <span className="date-input-text">{displayDate(value)}</span>
    <Icon name="calendar" size={17} />
    <input
      className="date-input-native"
      type="date"
      value={value}
      min={min}
      max={max}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    />
  </span>
}
