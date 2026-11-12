import type { Stage } from './types'

export const isCompleted = (stage: Stage) => stage === 'done' || stage === 'cancelled'

export const moveAfterIncomplete = <T extends { id: string }>(
  items: T[],
  id: string,
  isCompleted: (item: T) => boolean,
): T[] => {
  const item = items.find((other) => other.id === id)
  if (!item) return items
  const others = items.filter((other) => other.id !== id)
  const lastIncompleteIndex = others.findLastIndex((other) => !isCompleted(other))
  return [...others.slice(0, lastIncompleteIndex + 1), item, ...others.slice(lastIncompleteIndex + 1)]
}
