interface Point { label: string; value: number }

export function MiniChart({ points, suffix = '', emptyText = '完成几次记录后显示趋势' }: { points: Point[]; suffix?: string; emptyText?: string }) {
  if (points.length < 2) return <div className="chart-empty">{emptyText}</div>
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const width = 300
  const height = 96
  const coords = points.map((point, index) => ({
    x: points.length === 1 ? width / 2 : (index / (points.length - 1)) * (width - 20) + 10,
    y: height - 15 - ((point.value - min) / range) * (height - 34),
    ...point,
  }))
  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  return <div className="mini-chart">
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`趋势从 ${values[0]} 到 ${values.at(-1)}${suffix}`}>
      <path className="chart-area" d={`${path} L ${coords.at(-1)?.x} ${height} L ${coords[0].x} ${height} Z`} />
      <path className="chart-line" d={path} />
      {coords.map((point) => <circle key={`${point.label}-${point.x}`} cx={point.x} cy={point.y} r="3.5" />)}
    </svg>
    <div className="chart-labels"><span>{points[0].label}</span><strong>{points.at(-1)?.value.toFixed(1)}{suffix}</strong><span>{points.at(-1)?.label}</span></div>
  </div>
}
