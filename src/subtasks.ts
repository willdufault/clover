import type { Subtask } from './types'

// Move a subtask right after the last open subtask.
export const moveSubtaskAfterLastOpen = (subtasks: Subtask[], id: string): Subtask[] => {
  const item = subtasks.find((subtask) => subtask.id === id)
  if (!item) return subtasks
  const rest = subtasks.filter((subtask) => subtask.id !== id)
  const lastOpen = rest.findLastIndex((subtask) => !subtask.done)
  return [...rest.slice(0, lastOpen + 1), item, ...rest.slice(lastOpen + 1)]
}
