const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Today as YYYY-MM-DD in the local timezone.
export const today = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(now)

export const tomorrow = (now = new Date()) => addDays(today(now), 1)

// Next Monday, strictly after today.
export const nextMonday = (now = new Date()) => {
  const t = today(now)
  const weekday = new Date(`${t}T00:00:00Z`).getUTCDay()
  return addDays(t, (8 - weekday) % 7 || 7)
}

export const isOverdue = (due: string, now = new Date()) => due < today(now)

export const formatDue = (due: string, now = new Date()) => {
  const t = today(now)
  if (due === addDays(t, -1)) return 'Yesterday'
  if (due === t) return 'Today'
  if (due === addDays(t, 1)) return 'Tomorrow'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
    .format(new Date(`${due}T00:00:00Z`))
    .replace(',', '')
}
