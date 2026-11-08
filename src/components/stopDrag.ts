// Keep clicks on controls inside a draggable row from starting a drag or selecting the row.
const stop = (e: React.SyntheticEvent) => e.stopPropagation()
export const stopDrag = { onPointerDown: stop, onClick: stop }
