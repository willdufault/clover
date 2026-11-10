import { useDroppable } from '@dnd-kit/core'
import { navRowClass } from '../styles'
import { TODAY_VIEW_ID, TODAY_VIEW_NAME } from '../views'
import { Count } from './Count'

// Sidebar Today row: drop target only.
export function TodayRow({
  selected,
  dragOver,
  count,
  onClick,
}: {
  count: number
  selected: boolean
  dragOver: boolean
  onClick: () => void
}) {
  const { setNodeRef } = useDroppable({ id: TODAY_VIEW_ID })
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={navRowClass(selected, dragOver)}
    >
      <span>{TODAY_VIEW_NAME}</span>
      <Count count={count} />
    </div>
  )
}
