import type { Priority, Stage } from './types'

export const STAGE: Record<Stage, { emoji: string; label: string }> = {
  progress: { emoji: '⚡', label: 'In progress' },
  waiting: { emoji: '⏳', label: 'Waiting' },
  done: { emoji: '✅', label: 'Done' },
  // U+FE0F forces emoji rendering; the native dropdown list otherwise shows a plain x
  cancelled: { emoji: '❌️', label: 'Cancelled' },
}

export const PRIORITY: Record<Priority, { emoji: string; label: string }> = {
  low: { emoji: '🔵', label: 'Low' },
  high: { emoji: '🔴', label: 'High' },
}
