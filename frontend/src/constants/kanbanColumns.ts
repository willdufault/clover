export const KANBAN_COLUMNS = [
  "📝 todo",
  "⚡ in progress",
  "⌛ waiting",
  "🎉 done"
] as const

export const DEFAULT_STAGE = KANBAN_COLUMNS[0]
