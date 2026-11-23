import enums from '../../shared/enums.json'
import type { Priority, Stage } from './types'

type Label = { emoji: string; label: string }

export const STAGE_LABELS: Record<Stage, Label> = {
  open: { emoji: '⚪', label: 'Open' },
  inProgress: { emoji: '⚡', label: 'In progress' },
  waiting: { emoji: '⏳', label: 'Waiting' },
  done: { emoji: '✅', label: 'Done' },
  // U+FE0F forces emoji rendering; the native dropdown list otherwise shows a plain x
  cancelled: { emoji: '❌️', label: 'Cancelled' },
}

export const STAGES = enums.stages

export const stageLabel = (stage: Stage) => STAGE_LABELS[stage] ?? { emoji: '', label: stage }

const PRIORITY_LABELS: Record<Priority, Label> = {
  high: { emoji: '🔴', label: 'High' },
  medium: { emoji: '🟡', label: 'Medium' },
  low: { emoji: '🟢', label: 'Low' },
}

export const PRIORITIES = enums.priorities

export const priorityLabel = (priority: Priority) => PRIORITY_LABELS[priority] ?? { emoji: '', label: priority }

export const labelText = ({ emoji, label }: Label) => `${emoji} ${label}`
