const pad = (value: number) => String(value).padStart(2, '0')

export const toLocalISODate = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const addDays = (value: string, amount: number) => {
  const date = parseLocalDate(value)
  date.setDate(date.getDate() + amount)
  return toLocalISODate(date)
}

export const formatChineseDate = (value: string, withYear = false) => {
  const date = parseLocalDate(value)
  return new Intl.DateTimeFormat('zh-CN', {
    ...(withYear ? { year: 'numeric' as const } : {}),
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date)
}

export const getWeekdayName = (weekday: number) => ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][weekday]

export const daysBetween = (from: string, to: string) =>
  Math.floor((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000)

export const getWeekStart = (value: string, weekStartsOn: 0 | 1 = 1) => {
  const date = parseLocalDate(value)
  const delta = (date.getDay() - weekStartsOn + 7) % 7
  date.setDate(date.getDate() - delta)
  return toLocalISODate(date)
}

export const getLastNDates = (count: number, ending = toLocalISODate()) =>
  Array.from({ length: count }, (_, index) => addDays(ending, index - count + 1))
