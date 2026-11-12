// Next ordered selection after clicking clickedId. The last item is the range start.
export const nextSelection = (
  selected: string[],
  visibleIds: string[],
  clickedId: string,
  { ctrl, shift }: { ctrl: boolean; shift: boolean },
): string[] => {
  if (ctrl)
    return selected.includes(clickedId)
      ? selected.filter((id) => id !== clickedId)
      : [...selected, clickedId]
  const from = visibleIds.indexOf(selected.at(-1) ?? '')
  const to = visibleIds.indexOf(clickedId)
  if (!shift || from < 0 || to < 0) return [clickedId]
  const range = from <= to ? visibleIds.slice(from, to + 1) : visibleIds.slice(to, from + 1).reverse()
  return [...selected, ...range.filter((id) => !selected.includes(id))]
}
