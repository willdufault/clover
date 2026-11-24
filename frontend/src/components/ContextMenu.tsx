import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { nextMonday, today, tomorrow } from '../dates'
import { PRIORITIES, priorityLabel, STAGES, stageLabel, formatLabel } from '../labels'
import { MENU_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS, ICON_BUTTON_CLASS } from '../styles'
import { RowKind, type TaskList, type TaskPatch } from '../types'
import { useModalFocus } from '../useModalFocus'

const MENU_WIDTH = 208

type MenuItem = { key?: string; label: string; action?: () => void; danger?: boolean; submenu?: MenuItem[] }

function SubmenuRow({
  label,
  submenu,
  isTouch,
  open,
  setOpen,
  renderItem,
}: {
  label: string
  submenu: MenuItem[]
  isTouch: boolean
  open: boolean
  setOpen: (open: boolean) => void
  renderItem: (item: MenuItem) => React.ReactNode
}) {
  const [openLeft, setOpenLeft] = useState(false)
  const [topOffset, setTopOffset] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return setTopOffset(0)
    setTopOffset(Math.min(0, window.innerHeight - panelRef.current.getBoundingClientRect().bottom))
  }, [open])
  const openPanel = (row: HTMLElement) => {
    setOpenLeft(row.getBoundingClientRect().right + MENU_WIDTH > window.innerWidth)
    setOpen(true)
  }
  return (
    <div
      className="relative"
      onPointerEnter={(event) => !isTouch && event.pointerType === 'mouse' && openPanel(event.currentTarget)}
      onPointerLeave={(event) => !isTouch && event.pointerType === 'mouse' && setOpen(false)}
    >
      <button
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => (open ? setOpen(false) : openPanel(event.currentTarget))}
        className={'flex justify-between text-ink ' + MENU_ITEM_CLASS}
      >
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
          role="menu"
          style={{ top: topOffset, width: MENU_WIDTH }}
          className={
            'absolute -mt-1 max-h-80 overflow-y-auto ' + MENU_CLASS + ' ' + (openLeft ? 'right-full' : 'left-full')
          }
        >
          {submenu.map(renderItem)}
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
  anyHasDue: boolean
  allInToday: boolean
  allStepsDone?: boolean
}

export type OpenContextMenu = (
  kind: RowKind,
  id: string,
) => (event: { clientX: number; clientY: number }, longPress?: { title: string }) => void

export default function ContextMenu({
  menu,
  onClose,
  onDelete,
  onUpdateTasks,
  onSetStepCompleted,
}: {
  menu: ContextMenuState
  onClose: () => void
  onDelete: () => void
  onUpdateTasks: (patch: TaskPatch) => void
  onSetStepCompleted: (completed: boolean) => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [openSubmenuLabel, setOpenSubmenuLabel] = useState<string | null>(null)
  const [sheet, setSheet] = useState<{ label: string; submenu: MenuItem[] } | null>(null)
  const [mainClass, setMainClass] = useState<string>()
  const isTouch = window.matchMedia('(pointer: coarse)').matches
  useLayoutEffect(() => {
    if (menuRef.current)
      menuRef.current.style.top = Math.min(menu.y, window.innerHeight - menuRef.current.offsetHeight) + 'px'
  })

  useModalFocus(true)

  const prevSheetLabel = useRef<string | null>(null)
  useEffect(() => {
    if (!menuRef.current) return
    menuRef.current.scrollTop = 0
    const items = [...menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    ;(items.find((item) => item.textContent === prevSheetLabel.current) ?? items[0])?.focus()
    prevSheetLabel.current = sheet?.label ?? null
  }, [sheet])

  const goBack = () => {
    setMainClass('slide-from-left')
    setSheet(null)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (sheet) goBack()
      else onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })

  const taskItems: MenuItem[] = [
    menu.allInToday
      ? { label: '☀️ Remove from Today', action: () => onUpdateTasks({ addedToToday: false }) }
      : { label: '☀️ Add to Today', action: () => onUpdateTasks({ addedToToday: true }) },
    {
      label: 'Set stage',
      submenu: STAGES.map((stage) => ({
        label: formatLabel(stageLabel(stage)),
        action: () => onUpdateTasks({ stage }),
      })),
    },
    {
      label: 'Set due date',
      submenu: [
        { label: 'Today', action: () => onUpdateTasks({ due: today() }) },
        { label: 'Tomorrow', action: () => onUpdateTasks({ due: tomorrow() }) },
        { label: 'Next week', action: () => onUpdateTasks({ due: nextMonday() }) },
        ...(menu.anyHasDue ? [{ label: 'Remove', action: () => onUpdateTasks({ due: null }), danger: true }] : []),
      ],
    },
    ...moveItems(menu.moveTargets, onUpdateTasks),
    {
      label: 'Set priority',
      submenu: PRIORITIES.map((priority) => ({
        label: formatLabel(priorityLabel(priority)),
        action: () => onUpdateTasks({ priority }),
      })),
    },
  ]

  const stepItems: MenuItem[] = [
    menu.allStepsDone
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
    if (submenu)
      return (
        <SubmenuRow
          key={item.label}
          label={item.label}
          submenu={submenu}
          isTouch={isTouch}
          open={!isTouch && openSubmenuLabel === item.label}
          setOpen={(open) =>
            isTouch ? setSheet({ label: item.label, submenu }) : setOpenSubmenuLabel(open ? item.label : null)
          }
          renderItem={renderItem}
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
        ref={menuRef}
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
              <button aria-label="Back" onClick={goBack} className={ICON_BUTTON_CLASS + ' m-1.5 text-ink-soft'}>
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
            {sheet.submenu.map(renderItem)}
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
            {kindItems.map(renderItem)}
            {kindItems.length > 0 && <hr className="mx-2 my-1 border-line" />}
            {renderItem({ label: 'Delete', action: onDelete, danger: true })}
          </div>
        )}
      </div>
    </>
  )
}
