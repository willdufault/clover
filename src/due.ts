const addDays = (date: string, days: number) => {
  const result = new Date(`${date}T00:00:00Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

// Today as YYYY-MM-DD in the local timezone.
export const today = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA').format(now)

export const tomorrow = (now = new Date()) => addDays(today(now), 1)

// Next Monday, strictly after today.
export const nextMonday = (now = new Date()) => {
  const todayDate = today(now)
  const weekday = new Date(`${todayDate}T00:00:00Z`).getUTCDay()
  return addDays(todayDate, (8 - weekday) % 7 || 7)
}

export const isOverdue = (due: string, now = new Date()) => due < today(now)

export const relativeDay = (due: string, now = new Date()) => {
  const todayDate = today(now)
  if (due === addDays(todayDate, -1)) return 'Yesterday'
  if (due === todayDate) return 'Today'
  if (due === addDays(todayDate, 1)) return 'Tomorrow'
}

export const formatDue = (due: string, now = new Date()) =>
  relativeDay(due, now) ??
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
    .format(new Date(`${due}T00:00:00Z`))
    .replace(',', '')
