import enums from './shared/enums.json'

type EmojiLabel = { emoji: string; text: string }

const STAGE_LABELS: Record<string, EmojiLabel> = {
  open: { emoji: '⚪', text: 'Open' },
  inProgress: { emoji: '⚡', text: 'In progress' },
  waiting: { emoji: '⏳', text: 'Waiting' },
  done: { emoji: '✅', text: 'Done' },
  // U+FE0F forces emoji rendering; the native dropdown list otherwise shows a plain x
  cancelled: { emoji: '❌️', text: 'Cancelled' },
}

export const STAGES = enums.stages

export const isCompleted = (stage: string) => stage === 'done' || stage === 'cancelled'

export const stageLabel = (stage: string) => STAGE_LABELS[stage] ?? { emoji: '', text: stage }

const PRIORITY_LABELS: Record<string, EmojiLabel> = {
  high: { emoji: '🔴', text: 'High' },
  medium: { emoji: '🟡', text: 'Medium' },
  low: { emoji: '🟢', text: 'Low' },
}

export const PRIORITIES = enums.priorities

export const priorityLabel = (priority: string) => PRIORITY_LABELS[priority] ?? { emoji: '', text: priority }

export const formatLabel = ({ emoji, text }: EmojiLabel) => `${emoji} ${text}`
