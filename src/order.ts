// Move an item right after the last open item.
export const moveAfterLastOpen = <T extends { id: string }>(
  items: T[],
  id: string,
  isOpen: (item: T) => boolean,
): T[] => {
  const item = items.find((other) => other.id === id)
  if (!item) return items
  const others = items.filter((other) => other.id !== id)
  const lastOpenIndex = others.findLastIndex(isOpen)
  return [...others.slice(0, lastOpenIndex + 1), item, ...others.slice(lastOpenIndex + 1)]
}
