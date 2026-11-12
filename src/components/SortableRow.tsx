import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { RowKind } from '../types'

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
  kind: RowKind
  text: string
  tag: 'li' | 'div'
  className?: string
  onClick?: (event: React.MouseEvent) => void
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
      data-kind={kind}
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
