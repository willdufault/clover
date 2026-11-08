import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ItemKind } from '../types'

// Row that can be dragged among its SortableContext siblings.
export function SortableRow({
  id,
  kind,
  text,
  tag,
  className,
  onClick,
  onContextMenu,
  children,
}: {
  id: string
  kind: ItemKind
  text: string
  tag: 'li' | 'div'
  className?: string
  onClick?: () => void
  onContextMenu?: (event: React.MouseEvent) => void
  children: React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { kind, text } })
  const Tag = tag
  return (
    <Tag
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={isDragging ? 'opacity-60 shadow-lg ' + className : className}
      {...attributes}
      {...listeners}
    >
      {children}
    </Tag>
  )
}
