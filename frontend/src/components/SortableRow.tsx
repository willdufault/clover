import { createContext, useContext, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { RowKind } from '../types'
import type { MenuAnchor } from './ContextMenu'

const OVERLAY_BG: Record<RowKind, string> = {
  [RowKind.List]: 'bg-parchment',
  [RowKind.Task]: 'bg-linen',
  [RowKind.Step]: 'bg-parchment',
}

export const DropAfterContext = createContext(false)

type Press = { x: number; y: number; timer: number; fired: boolean }

const useLongPress = (onLongPress: (event: MenuAnchor) => void, dragging: boolean) => {
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
      const rect = event.currentTarget.getBoundingClientRect()
      const state: Press = { x: clientX, y: clientY, fired: false, timer: 0 }
      state.timer = window.setTimeout(() => {
        state.fired = true
        setPressing(false)
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))
        onLongPress({ clientX, clientY: rect.bottom + 4, above: rect.top - 4 })
      }, 500)
      press.current = state
      setPressing(true)
    },
    onTouchMove: (event: React.TouchEvent) => {
      const touch = event.touches[0]
      const start = press.current
      if (
        touch &&
        start &&
        !start.fired &&
        Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > (dragging ? 4 : 10)
      )
        cancel()
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
      className={'pointer-events-none h-full overflow-hidden rounded-lg shadow-md ' + OVERLAY_BG[kind]}
    >
      <Tag className={rowClass}>{children}</Tag>
    </Wrapper>
  )
  const { attributes, listeners, setNodeRef, isDragging, isOver, activeIndex } = useSortable({
    id,
    data: { kind, clone },
  })
  const dropAfter = useContext(DropAfterContext)
  const dropIndicator =
    !isOver || activeIndex === -1
      ? ''
      : 'relative before:absolute before:inset-x-1 before:h-0.5 before:rounded-full before:bg-clover ' +
        (dropAfter ? 'before:bottom-0 ' : 'before:top-0 ')
  const {
    pressing,
    onTouchStart: onPressStart,
    ...longPressHandlers
  } = useLongPress((event) => onContextMenu?.(event), isDragging)
  const hideClass = pressing ? 'invisible ' : 'hidden! '
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
        (isDragging || hidden ? hideClass : dropIndicator) +
        (pressing ? 'duration-500 ease-out motion-safe:scale-98 ' : '') +
        rowClass
      }
      {...longPressHandlers}
      {...attributes}
      {...listeners}
      onTouchStart={(event) => {
        onPressStart(event)
        listeners?.onTouchStart?.(event)
      }}
    >
      {children}
    </Tag>
  )
}
