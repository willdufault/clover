// Keep clicks on controls inside a draggable row from starting a drag or selecting the row.
const stopPropagation = (event: React.SyntheticEvent) => event.stopPropagation()
export const ignoreRowEvents = { onPointerDown: stopPropagation, onClick: stopPropagation }
