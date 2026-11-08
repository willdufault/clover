import type { Subtask } from './types'

// Move a subtask right after the last open subtask.
export const moveSubtaskAfterLastOpen = (subtasks: Subtask[], id: string): Subtask[] => {
  const subtask = subtasks.find((other) => other.id === id)
  if (!subtask) return subtasks
  const others = subtasks.filter((other) => other.id !== id)
  const lastOpenIndex = others.findLastIndex((other) => !other.done)
  return [...others.slice(0, lastOpenIndex + 1), subtask, ...others.slice(lastOpenIndex + 1)]
}
