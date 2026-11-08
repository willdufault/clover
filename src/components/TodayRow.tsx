import { useDroppable } from '@dnd-kit/core'
import { navRowClass } from '../styles'
import { TODAY } from '../views'
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
  const { setNodeRef } = useDroppable({ id: TODAY })
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={navRowClass(selected, dragOver)}
    >
      <span>Today</span>
      <Count n={count} />
    </div>
  )
}
