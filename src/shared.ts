import type { Priority, Task } from './drop'
import { isOverdue } from './due'

export const ItemType = {
  List: 'list',
  Task: 'task',
  Subtask: 'subtask',
} as const
export type ItemType = (typeof ItemType)[keyof typeof ItemType]

export type Stage = NonNullable<Task['stage']>

export const FIELD =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500'

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

export function navRowClass(selected: boolean, dragOver: boolean) {
  return (
    'flex select-none items-center justify-between rounded-md px-3 py-1.5 text-left text-sm ' +
    (dragOver
      ? 'bg-blue-100 outline-2 outline-blue-300 text-gray-800'
      : selected
        ? 'bg-gray-200 font-medium text-gray-800'
        : 'text-gray-600 hover:bg-gray-200/60')
  )
}

export const dueClass = (due: string) =>
  'text-xs ' + (isOverdue(due) ? 'text-red-600' : 'text-gray-500')
