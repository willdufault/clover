// Keep clicks on controls inside a draggable row from starting a drag or selecting the row.
const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation()
export const stopDrag = { onPointerDown: stopPropagation, onClick: stopPropagation }
