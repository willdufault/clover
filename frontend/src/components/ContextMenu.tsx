import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { nextMonday, today, tomorrow } from '../dates'
import { PRIORITIES, PRIORITY_LABELS, STAGES, STAGE_LABELS, labelText } from '../labels'
import { MENU_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '../styles'
import { RowKind, type TaskPatch } from '../types'

const MENU_WIDTH = 208

type MenuItem = { label: string; action?: () => void; danger?: boolean; submenu?: MenuItem[] }

function SubmenuRow({
  label,
  submenu,
  renderItems,
}: {
  label: string
  submenu: MenuItem[]
  renderItems: (items: MenuItem[]) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [flip, setFlip] = useState(false)
  const [shift, setShift] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return setShift(0)
    setShift(Math.min(0, window.innerHeight - panelRef.current.getBoundingClientRect().bottom))
  }, [open])
  return (
    <div
      className="relative"
      onMouseEnter={(event) => {
        setFlip(event.currentTarget.getBoundingClientRect().right + MENU_WIDTH > window.innerWidth)
        setOpen(true)
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <button className={'flex justify-between text-ink ' + MENU_ITEM_CLASS}>
        <span>{label}</span>
        <svg
          viewBox="0 0 16 16"
          className="size-3.5 self-center text-ink-faint"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
      </button>
      {open && (
        <div
          ref={panelRef}
          style={{ top: shift, width: MENU_WIDTH }}
          className={'absolute -mt-1 ' + MENU_CLASS + ' ' + (flip ? 'right-full' : 'left-full')}
        >
          {renderItems(submenu)}
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
  hasDue: boolean
  allInToday: boolean
  allDone?: boolean
}

export type OpenContextMenu = (kind: RowKind, id: string) => (event: React.MouseEvent) => void

export default function ContextMenu({
  menu,
  onClose,
  onDelete,
  onUpdate,
  onSetStepCompleted,
}: {
  menu: ContextMenuState
  onClose: () => void
  onDelete: () => void
  onUpdate: (patch: TaskPatch) => void
  onSetStepCompleted: (completed: boolean) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(menu.y)
  useLayoutEffect(() => {
    if (ref.current) setTop(Math.min(menu.y, window.innerHeight - ref.current.offsetHeight))
  }, [menu.y])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault() // tells App's Escape handler this one is taken
      onClose()
    }
    // Capture so this runs before App's bubbling listener.
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  const taskItems: MenuItem[] = [
    menu.allInToday
      ? { label: '☀️ Remove from Today', action: () => onUpdate({ addedToToday: false }) }
      : { label: '☀️ Add to Today', action: () => onUpdate({ addedToToday: true }) },
    {
      label: 'Set stage',
      submenu: STAGES.map((stage) => ({
        label: labelText(STAGE_LABELS[stage]),
        action: () => onUpdate({ stage }),
      })),
    },
    {
      label: 'Set due date',
      submenu: [
        { label: 'Today', action: () => onUpdate({ due: today() }) },
        { label: 'Tomorrow', action: () => onUpdate({ due: tomorrow() }) },
        { label: 'Next week', action: () => onUpdate({ due: nextMonday() }) },
        ...(menu.hasDue ? [{ label: 'Remove', action: () => onUpdate({ due: null }), danger: true }] : []),
      ],
    },
    {
      label: 'Set priority',
      submenu: PRIORITIES.map((priority) => ({
        label: labelText(PRIORITY_LABELS[priority]),
        action: () => onUpdate({ priority }),
      })),
    },
  ]

  const renderItems = (items: MenuItem[]): React.ReactNode =>
    items.map((item) =>
      item.submenu ? (
        <SubmenuRow key={item.label} label={item.label} submenu={item.submenu} renderItems={renderItems} />
      ) : (
        <button
          key={item.label}
          onClick={() => {
            item.action?.()
            onClose()
          }}
          className={'block ' + MENU_ITEM_CLASS + ' ' + (item.danger ? 'text-coral' : 'text-ink')}
        >
          {item.label}
        </button>
      ),
    )

  return (
    <>
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
        className={'fixed z-50 ' + MENU_CLASS}
        style={{
          left: Math.min(menu.x, window.innerWidth - MENU_WIDTH),
          top,
          width: MENU_WIDTH,
        }}
      >
        {menu.ids.length > 1 && (
          <p className={MENU_LABEL_CLASS}>
            {menu.ids.length} {menu.kind === RowKind.Task ? 'tasks' : 'steps'}
          </p>
        )}
        {menu.kind === RowKind.Task && (
          <>
            {renderItems(taskItems)}
            <hr className="mx-2 my-1 border-line" />
          </>
        )}
        {menu.kind === RowKind.Step && (
          <>
            {renderItems([
              menu.allDone
                ? { label: 'Mark as open', action: () => onSetStepCompleted(false) }
                : { label: 'Mark as done', action: () => onSetStepCompleted(true) },
            ])}
            <hr className="mx-2 my-1 border-line" />
          </>
        )}
        {renderItems([{ label: 'Delete', action: onDelete, danger: true }])}
      </div>
    </>
  )
}
