import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { nextMonday, today, tomorrow } from '../dates'
import { PRIORITIES, PRIORITY_LABELS, STAGES, STAGE_LABELS, labelText } from '../labels'
import { MENU_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS, X_BUTTON_CLASS } from '../styles'
import { RowKind, type TaskList, type TaskPatch } from '../types'

const MENU_WIDTH = 208

type MenuItem = { key?: string; label: string; action?: () => void; danger?: boolean; submenu?: MenuItem[] }

const chevron = (
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
)

function SubmenuRow({
  label,
  submenu,
  open,
  setOpen,
  renderItems,
}: {
  label: string
  submenu: MenuItem[]
  open: boolean
  setOpen: (open: boolean) => void
  renderItems: (items: MenuItem[]) => React.ReactNode
}) {
  const [flip, setFlip] = useState(false)
  const [shift, setShift] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return setShift(0)
    setShift(Math.min(0, window.innerHeight - panelRef.current.getBoundingClientRect().bottom))
  }, [open])
  const show = (row: HTMLElement) => {
    setFlip(row.getBoundingClientRect().right + MENU_WIDTH > window.innerWidth)
    setOpen(true)
  }
  return (
    <div
      className="relative"
      onPointerEnter={(event) => event.pointerType === 'mouse' && show(event.currentTarget)}
      onPointerLeave={(event) => event.pointerType === 'mouse' && setOpen(false)}
    >
      <button
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => (open ? setOpen(false) : show(event.currentTarget))}
        className={'flex justify-between text-ink ' + MENU_ITEM_CLASS}
      >
        <span>{label}</span>
        {chevron}
      </button>
      {open && (
        <div
          ref={panelRef}
          role="menu"
          style={{ top: shift, width: MENU_WIDTH }}
          className={
            'absolute -mt-1 max-h-80 overflow-y-auto ' + MENU_CLASS + ' ' + (flip ? 'right-full' : 'left-full')
          }
        >
          {renderItems(submenu)}
        </div>
      )}
    </div>
  )
}

const moveItems = (lists: TaskList[], onUpdate: (patch: TaskPatch) => void): MenuItem[] =>
  lists.length
    ? [
        {
          label: 'Move to list',
          submenu: lists.map((list) => ({
            key: list.id,
            label: list.name,
            action: () => onUpdate({ listId: list.id }),
          })),
        },
      ]
    : []

export type ContextMenuState = {
  x: number
  y: number
  kind: RowKind
  ids: string[]
  title?: string
  moveTargets: TaskList[]
  hasDue: boolean
  allInToday: boolean
  allDone?: boolean
}

export type OpenContextMenu = (
  kind: RowKind,
  id: string,
) => (event: { clientX: number; clientY: number }, longPressTitle?: string) => void

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
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)
  const [sheet, setSheet] = useState<{ label: string; submenu: MenuItem[] } | null>(null)
  const [mainClass, setMainClass] = useState<string>()
  const [previous] = useState(() => document.activeElement as HTMLElement | null)
  const touch = window.matchMedia('(pointer: coarse)').matches
  useLayoutEffect(() => {
    if (ref.current) ref.current.style.top = Math.min(menu.y, window.innerHeight - ref.current.offsetHeight) + 'px'
  })

  useEffect(() => () => previous?.focus(), [previous])

  const shown = useRef<string | null>(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.scrollTop = 0
    const items = [...ref.current.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    ;(items.find((item) => item.textContent === shown.current) ?? items[0])?.focus()
    shown.current = sheet?.label ?? null
  }, [sheet])

  const goBack = () => {
    setMainClass('slide-from-left')
    setSheet(null)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault() // tells App's Escape handler this one is taken
      if (sheet) goBack()
      else onClose()
    }
    // Capture so this runs before App's bubbling listener.
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })

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
    ...moveItems(menu.moveTargets, onUpdate),
    {
      label: 'Set priority',
      submenu: PRIORITIES.map((priority) => ({
        label: labelText(PRIORITY_LABELS[priority]),
        action: () => onUpdate({ priority }),
      })),
    },
  ]

  const stepItems: MenuItem[] = [
    menu.allDone
      ? { label: 'Mark as open', action: () => onSetStepCompleted(false) }
      : { label: 'Mark as done', action: () => onSetStepCompleted(true) },
  ]

  const kindItems = {
    [RowKind.List]: [],
    [RowKind.Task]: taskItems,
    [RowKind.Step]: stepItems,
  }[menu.kind]

  const renderItem = (item: MenuItem) => {
    const submenu = item.submenu
    if (submenu && touch)
      return (
        <button
          key={item.label}
          role="menuitem"
          aria-haspopup="menu"
          onClick={() => setSheet({ label: item.label, submenu })}
          className={'flex justify-between text-ink ' + MENU_ITEM_CLASS}
        >
          <span>{item.label}</span>
          {chevron}
        </button>
      )
    if (item.submenu)
      return (
        <SubmenuRow
          key={item.label}
          label={item.label}
          submenu={item.submenu}
          open={openSubmenu === item.label}
          setOpen={(open) => setOpenSubmenu(open ? item.label : null)}
          renderItems={renderItems}
        />
      )
    return (
      <button
        key={item.key ?? item.label}
        role="menuitem"
        onClick={() => {
          item.action?.()
          onClose()
        }}
        className={'block ' + MENU_ITEM_CLASS + ' ' + (item.danger ? 'text-coral' : 'text-ink')}
      >
        {item.label}
      </button>
    )
  }

  const renderItems = (items: MenuItem[]): React.ReactNode => items.map(renderItem)

  return (
    <>
      <div
        className="fixed inset-0 phone:z-40 sheet:bg-ink/20"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault()
          onClose()
        }}
      />
      <div
        ref={ref}
        role="menu"
        className={
          'fixed z-50 ' +
          MENU_CLASS +
          ' pointer-coarse:max-h-80 pointer-coarse:overflow-x-hidden pointer-coarse:overflow-y-auto sheet:inset-x-2! sheet:top-auto! sheet:bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] sheet:mx-auto sheet:w-auto! sheet:max-w-sm'
        }
        style={{
          left: Math.min(menu.x, window.innerWidth - MENU_WIDTH),
          width: MENU_WIDTH,
        }}
      >
        {sheet ? (
          <div key={sheet.label} className="slide-from-right">
            <div className="sticky -top-1 z-10 flex items-center gap-1 bg-paper">
              <button aria-label="Back" onClick={goBack} className={X_BUTTON_CLASS + ' m-1.5 text-ink-soft'}>
                <svg
                  viewBox="0 0 16 16"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13 8H3m4-4L3 8l4 4" />
                </svg>
              </button>
              <p className="font-semibold text-ink">{sheet.label}</p>
            </div>
            {renderItems(sheet.submenu)}
          </div>
        ) : (
          <div className={mainClass}>
            {menu.ids.length === 1 && menu.title && (
              <p className="truncate px-3 pt-2 pb-1 text-xs text-ink-soft pointer-fine:hidden">{menu.title}</p>
            )}
            {menu.ids.length > 1 && (
              <p className={MENU_LABEL_CLASS}>
                {menu.ids.length} {menu.kind === RowKind.Task ? 'tasks' : 'steps'}
              </p>
            )}
            {renderItems(kindItems)}
            {kindItems.length > 0 && <hr className="mx-2 my-1 border-line" />}
            {renderItems([{ label: 'Delete', action: onDelete, danger: true }])}
          </div>
        )}
      </div>
    </>
  )
}
