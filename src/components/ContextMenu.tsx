import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { nextMonday, today, tomorrow } from '../dates'
import { PRIORITIES, PRIORITY_LABELS, STAGES, STAGE_LABELS } from '../labels'
import { MENU_CLASS, MENU_ITEM_CLASS } from '../styles'
import { RowKind, type Priority, type Stage } from '../types'

const MENU_WIDTH = 208

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
      <button className={"flex justify-between text-ink " + MENU_ITEM_CLASS}>
        <span>{item.label}</span>
        <svg viewBox="0 0 16 16" className="size-3.5 self-center text-ink-faint" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4l4 4-4 4" /></svg>
      </button>
      {open && (
        <div
          ref={panelRef}
          style={{ top: shift }}
          className={
            'absolute -mt-1 w-52 ' + MENU_CLASS + ' ' +
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
  allInToday?: boolean
  allDone?: boolean
}

export type OpenContextMenu = (kind: RowKind, id: string) => (event: React.MouseEvent) => void

export default function ContextMenu({
  menu,
  onClose,
  onDelete,
  onSetDue,
  onSetToday,
  onSetPriority,
  onSetStage,
  onSetStepCompleted,
}: {
  menu: ContextMenuState
  onClose: () => void
  onDelete: () => void
  onSetDue: (due?: string) => void
  onSetToday: (added: boolean) => void
  onSetPriority: (priority: Priority) => void
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
      ? { label: '☀️ Remove from Today', action: () => onSetToday(false) }
      : { label: '☀️ Add to Today', action: () => onSetToday(true) },
    {
      label: 'Set stage',
      submenu: STAGES.map((stage) => ({
        label: STAGE_LABELS[stage].emoji + ' ' + STAGE_LABELS[stage].label,
        action: () => onSetStage(stage),
      })),
    },
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
      submenu: PRIORITIES.map((priority) => ({
        label: PRIORITY_LABELS[priority].emoji + ' ' + PRIORITY_LABELS[priority].label,
        action: () => onSetPriority(priority),
      })),
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
            'block ' + MENU_ITEM_CLASS + ' ' +
            (item.danger ? 'text-coral' : 'text-ink')
          }
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
        className={"fixed z-50 w-52 " + MENU_CLASS}
        style={{
          left: Math.min(menu.x, window.innerWidth - MENU_WIDTH),
          top,
        }}
      >
        {menu.ids.length > 1 && (
          <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.07em] text-ink-soft uppercase">
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
