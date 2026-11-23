import { useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { RowKind } from '../types'

type Press = { x: number; y: number; timer: number; fired: boolean }

// iOS never fires contextmenu on long-press, so touch long-press is timed here and the native one is ignored.
const useLongPress = (onLongPress: (event: { clientX: number; clientY: number }) => void) => {
  const press = useRef<Press | null>(null)
  const [pressing, setPressing] = useState(false)
  const cancel = () => {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
    setPressing(false)
  }
  return {
    pressing,
    onTouchStart: (event: React.TouchEvent) => {
      const touch = event.touches[0]
      if (!touch || event.touches.length > 1) return cancel()
      const { clientX, clientY } = touch
      const state: Press = { x: clientX, y: clientY, fired: false, timer: 0 }
      state.timer = window.setTimeout(() => {
        state.fired = true
        setPressing(false)
        onLongPress({ clientX, clientY })
      }, 500)
      press.current = state
      setPressing(true)
    },
    onTouchMove: (event: React.TouchEvent) => {
      const touch = event.touches[0]
      const start = press.current
      if (touch && start && !start.fired && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10) cancel()
    },
    onTouchEnd: (event: React.TouchEvent) => {
      if (press.current?.fired) event.preventDefault()
      cancel()
    },
    onTouchCancel: cancel,
  }
}

export function SortableRow({
  id,
  kind,
  text,
  tag: Tag,
  className,
  onClick,
  onContextMenu,
  children,
}: {
  id: string
  kind: RowKind
  text: string
  tag: 'li' | 'div'
  className: string
  onClick: (event: React.MouseEvent) => void
  onContextMenu: (event: { clientX: number; clientY: number }, longPressTitle?: string) => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { kind, text },
  })
  const { pressing, ...longPress } = useLongPress((event) => onContextMenu(event, text))
  return (
    <Tag
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-kind={kind}
      onClick={onClick}
      onContextMenu={(event) => {
        event.preventDefault()
        if ((event.nativeEvent as PointerEvent).pointerType !== 'touch') onContextMenu(event)
      }}
      className={
        'touch-manipulation transition [-webkit-touch-callout:none] ' +
        (isDragging ? 'opacity-60 shadow-lg ' : '') +
        (pressing ? 'bg-cream duration-500 ease-out motion-safe:scale-[0.98] ' : '') +
        className
      }
      {...longPress}
      {...attributes}
      {...listeners}
    >
      {children}
    </Tag>
  )
}
