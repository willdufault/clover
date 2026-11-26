import { useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { RowKind } from '../types'
import type { MenuAnchor } from './ContextMenu'

type Press = { x: number; y: number; timer: number; fired: boolean }

const useLongPress = (onLongPress: (event: MenuAnchor) => void) => {
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
      const row = event.currentTarget
      const state: Press = { x: clientX, y: clientY, fired: false, timer: 0 }
      state.timer = window.setTimeout(() => {
        state.fired = true
        setPressing(false)
        const rect = row.getBoundingClientRect()
        onLongPress({ clientX, clientY: rect.bottom + 4, above: rect.top - 4 })
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
  tag: Tag,
  className,
  onClick,
  onContextMenu,
  hidden,
  children,
}: {
  id: string
  kind: RowKind
  tag: 'li' | 'div'
  className: string
  onClick?: (event: React.MouseEvent) => void
  onContextMenu?: (event: MenuAnchor) => void
  hidden?: boolean
  children: React.ReactNode
}) {
  const rowClass = 'touch-manipulation [-webkit-touch-callout:none] ' + className
  const Wrapper = Tag === 'li' ? 'ul' : 'div'
  const clone = (
    <Wrapper
      inert
      data-overlay
      className="pointer-events-none h-full overflow-hidden rounded-lg bg-parchment shadow-md"
    >
      <Tag className={rowClass}>{children}</Tag>
    </Wrapper>
  )
  const { attributes, listeners, setNodeRef, isDragging, isOver, index, activeIndex } = useSortable({
    id,
    data: { kind, clone },
  })
  const dropIndicator =
    !isOver || activeIndex === -1
      ? ''
      : 'relative before:absolute before:inset-x-1 before:h-0.5 before:rounded-full before:bg-clover ' +
        (index > activeIndex ? 'before:bottom-0 ' : 'before:top-0 ')
  const { pressing, ...longPressHandlers } = useLongPress((event) => onContextMenu?.(event))
  return (
    <Tag
      ref={setNodeRef}
      data-kind={kind}
      onClick={onClick}
      onContextMenu={(event) => {
        if (!onContextMenu) return
        event.preventDefault()
        if ((event.nativeEvent as PointerEvent).pointerType !== 'touch') onContextMenu(event)
      }}
      className={
        (isDragging || hidden ? 'hidden! ' : dropIndicator) +
        (pressing ? 'duration-500 ease-out motion-safe:scale-98 ' : '') +
        rowClass
      }
      {...longPressHandlers}
      {...attributes}
      {...listeners}
    >
      {children}
    </Tag>
  )
}
