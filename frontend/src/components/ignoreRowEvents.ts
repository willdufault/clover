const stopPropagation = (event: React.SyntheticEvent) => event.stopPropagation()
export const ignoreRowEvents = {
  onMouseDown: stopPropagation,
  onTouchStart: stopPropagation,
  onClick: stopPropagation,
}
