import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { nextMonday, today, tomorrow } from '../dates'
import { STAGE_LABELS } from '../labels'
import { RowKind, type Priority, type Stage } from '../types'

const MENU_WIDTH = 176

type MenuItem = { label: string; action?: () => void; danger?: boolean; submenu?: MenuItem[] }

function SubmenuRow({
  item,
  renderItems,
}: {
  item: MenuItem
  renderItems: (items: MenuItem[]) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [flip, setFlip] = useState(false)
  const [shift, setShift] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return setShift(0)
    setShift(Math.min(0, window.innerHeight - panelRef.current.getBoundingClientRect().bottom))
  }, [open])
  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => {
        setFlip(ref.current!.getBoundingClientRect().right + MENU_WIDTH > window.innerWidth)
        setOpen(true)
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="flex w-full cursor-default justify-between px-3 py-1.5 text-left text-gray-700 hover:bg-gray-100">
        <span>{item.label}</span>
        <span>›</span>
      </button>
      {open && (
        <div
          ref={panelRef}
          style={{ top: shift }}
          className={
            'absolute w-44 rounded-md border border-gray-300 bg-white py-1 shadow-lg ' +
            (flip ? 'right-full' : 'left-full')
          }
        >
          {renderItems(item.submenu!)}
        </div>
      )}
    </div>
  )
}

export type ContextMenuState = {
  x: number
  y: number
  kind: RowKind
  ids: string[]
  due?: string
}

export type OpenContextMenu = (kind: RowKind, id: string) => (event: React.MouseEvent) => void

export default function ContextMenu({
  menu,
  onClose,
  onDelete,
  onSetDue,
  onSetPriority,
  onSetStage,
  onSetStepCompleted,
}: {
  menu: ContextMenuState
  onClose: () => void
  onDelete: () => void
  onSetDue: (due?: string) => void
  onSetPriority: (priority?: Priority) => void
  onSetStage: (stage: Stage) => void
  onSetStepCompleted: (completed: boolean) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(menu.y)
  useLayoutEffect(() => {
    setTop(Math.min(menu.y, window.innerHeight - ref.current!.offsetHeight))
  }, [menu.y])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault() // tells App's Escape handler this one is taken
        onClose()
      }
    }
    // Capture so this runs before App's bubbling listener.
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  const stageItem = (stages: Stage[], action: (stage: Stage) => void): MenuItem => ({
    label: 'Set stage',
    submenu: stages.map((stage) => ({
      label: STAGE_LABELS[stage].emoji + ' ' + STAGE_LABELS[stage].label,
      action: () => action(stage),
    })),
  })

  const taskItems: MenuItem[] = [
    stageItem(Object.keys(STAGE_LABELS) as Stage[], onSetStage),
    {
      label: 'Set due date',
      submenu: [
        { label: 'Today', action: () => onSetDue(today()) },
        { label: 'Tomorrow', action: () => onSetDue(tomorrow()) },
        { label: 'Next week', action: () => onSetDue(nextMonday()) },
        ...(menu.due ? [{ label: 'Remove', action: () => onSetDue(), danger: true }] : []),
      ],
    },
    {
      label: 'Set priority',
      submenu: [
        { label: 'Low', action: () => onSetPriority('low') },
        { label: 'Medium', action: () => onSetPriority(undefined) },
        { label: 'High', action: () => onSetPriority('high') },
      ],
    },
  ]

  const renderItems = (items: MenuItem[]): React.ReactNode =>
    items.map((item) =>
      item.submenu ? (
        <SubmenuRow key={item.label} item={item} renderItems={renderItems} />
      ) : (
        <button
          key={item.label}
          onClick={() => {
            item.action?.()
            onClose()
          }}
          className={
            'block w-full cursor-default px-3 py-1.5 text-left hover:bg-gray-100 ' +
            (item.danger ? 'text-red-600' : 'text-gray-700')
          }
        >
          {item.label}
        </button>
      ),
    )

  return (
    <>
      {/* Invisible backdrop to catch clicks outside the menu. */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault()
          onClose()
        }}
      />
      <div
        ref={ref}
        className="fixed z-50 w-44 rounded-md border border-gray-300 bg-white py-1 text-sm shadow-lg"
        style={{
          left: Math.min(menu.x, window.innerWidth - MENU_WIDTH),
          top,
        }}
      >
        {menu.kind === RowKind.Task && (
          <>
            {renderItems(taskItems)}
            <hr className="my-1 border-gray-200" />
          </>
        )}
        {menu.kind === RowKind.Step && (
          <>
            {renderItems([
              stageItem(['open', 'done'], (stage) => onSetStepCompleted(stage === 'done')),
            ])}
            <hr className="my-1 border-gray-200" />
          </>
        )}
        {renderItems([{ label: 'Delete', action: onDelete, danger: true }])}
      </div>
    </>
  )
}
