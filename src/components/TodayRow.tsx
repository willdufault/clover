import { useDroppable } from '@dnd-kit/core'
import { sidebarRowClass } from '../styles'
import { TODAY_LIST_ID, TODAY_LIST_NAME } from '../smartLists'
import { TaskCountBadge } from './TaskCountBadge'

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
  const { setNodeRef } = useDroppable({ id: TODAY_LIST_ID })
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={'border-b border-gray-200 ' + sidebarRowClass(selected, dragOver)}
    >
      <span>{TODAY_LIST_NAME}</span>
      <TaskCountBadge count={count} />
    </div>
  )
}
