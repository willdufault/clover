import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSun as faSunRegular, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faArrowLeft, faChevronRight, faListUl, faSun } from '@fortawesome/free-solid-svg-icons'
import { formatDueDate, nextMonday, today, tomorrow } from '../dates'
import { dueIcon, PRIORITIES, priorityLabel, STAGES, stageLabel } from '../labels'
import { MENU_CLASS, MENU_ITEM_CLASS, ICON_BUTTON_CLASS } from '../styles'
import { RowKind, type TaskList, type TaskPatch } from '../types'
import { fit, Popover, rem } from './Popover'
import { IconSlot } from './IconSlot'
import { MenuOption, type MenuIcon } from './MenuOption'

export const MENU_WIDTH = 16

type MenuItem = {
  key?: string
  label: string
  icon?: MenuIcon
  action?: () => void
  checked?: boolean
  pickDate?: boolean
  value?: React.ReactNode
  submenu?: MenuItem[]
}

function PickDateItem({ onPick }: { onPick: (date: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="relative">
      <button role="menuitem" onClick={() => inputRef.current?.showPicker()} className={MENU_ITEM_CLASS}>
        Pick a date…
      </button>
      <input
        ref={inputRef}
        type="date"
        tabIndex={-1}
        aria-label="Pick a date"
        onChange={(event) => event.target.value && onPick(event.target.value)}
        className="sr-only"
      />
    </div>
  )
}

function SubmenuRow({
  label,
  icon,
  value,
  submenu,
  isTouch,
  open,
  setOpen,
  renderItem,
}: {
  label: string
  icon?: MenuIcon
  value?: React.ReactNode
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
    const rect = panelRef.current.getBoundingClientRect()
    setTopOffset(fit(rect.top, rect.height, window.innerHeight) - rect.top)
  }, [open])
  const openPanel = (row: HTMLElement) => {
    setOpenLeft(row.getBoundingClientRect().right + rem(MENU_WIDTH) + 18 > window.innerWidth)
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
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => (open ? setOpen(false) : openPanel(event.currentTarget))}
        className={MENU_ITEM_CLASS}
      >
        {icon && <IconSlot icon={icon.icon} color={icon.color} />}
        <span className="flex-1 whitespace-nowrap">{label}</span>
        {value}
        <FontAwesomeIcon icon={faChevronRight} className="text-xs text-lichen" />
      </button>
      {open && (
        <div
          ref={panelRef}
          style={{ top: topOffset }}
          className={'absolute top-0 ' + (openLeft ? 'right-full pr-2' : 'left-full pl-2')}
        >
          <div role="menu" style={{ width: rem(MENU_WIDTH) }} className={'max-h-96 overflow-y-auto ' + MENU_CLASS}>
            {submenu.map(renderItem)}
          </div>
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
          icon: { icon: faListUl, color: 'text-lichen' },
          submenu: lists.map((list) => ({
            key: list.id,
            label: list.name,
            action: () => onUpdate({ listId: list.id }),
          })),
        },
      ]
    : []

const dueItems = (menu: ContextMenuState, onUpdate: (patch: TaskPatch) => void): MenuItem[] => {
  const presets: [string, string][] = [
    ['Today', today()],
    ['Tomorrow', tomorrow()],
    ['Next week', nextMonday()],
  ]
  const custom = menu.due && !presets.some(([, due]) => due === menu.due) ? [menu.due] : []
  return [
    ...presets.map(([label, due]) => ({ label, checked: due === menu.due, action: () => onUpdate({ due }) })),
    ...custom.map((due) => ({ label: formatDueDate(due), checked: true })),
    { label: 'Pick a date…', pickDate: true },
    ...(menu.anyHasDue ? [{ label: 'Remove due date', action: () => onUpdate({ due: null }) }] : []),
  ]
}

export type ContextMenuState = {
  x: number
  y: number
  above?: number
  kind: RowKind
  ids: string[]
  title?: string
  moveTargets: TaskList[]
  anyHasDue: boolean
  allInToday: boolean
  stage?: string
  priority?: string
  due?: string | null
}

export type MenuAnchor = { clientX: number; clientY: number; above?: number }

export type OpenContextMenu = (kind: RowKind, id: string) => (event: MenuAnchor) => void

export default function ContextMenu({
  menu,
  onClose,
  onDelete,
  onUpdateTasks,
}: {
  menu: ContextMenuState
  onClose: () => void
  onDelete: () => void
  onUpdateTasks: (patch: TaskPatch) => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [openSubmenuLabel, setOpenSubmenuLabel] = useState<string | null>(null)
  const [sheet, setSheet] = useState<{ label: string; submenu: MenuItem[] } | null>(null)
  const [mainClass, setMainClass] = useState<string>()
  const isTouch = window.matchMedia('(pointer: coarse)').matches

  const prevSheetLabel = useRef<string | null>(null)
  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const panel = content.parentElement
    if (panel) panel.scrollTop = 0
    const items = [...content.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    const previous = items.find((item) => prevSheetLabel.current && item.ariaLabel === prevSheetLabel.current)
    if (previous) previous.focus()
    else if (prevSheetLabel.current === null && sheet) panel?.focus()
    prevSheetLabel.current = sheet?.label ?? null
  }, [sheet])

  const goBack = () => {
    setMainClass('fade-in')
    setSheet(null)
  }

  const taskItems: MenuItem[] = [
    {
      label: 'Set stage',
      icon: stageLabel(menu.stage ?? 'open'),
      submenu: STAGES.map((stage) => ({
        label: stageLabel(stage).text,
        icon: stageLabel(stage),
        checked: stage === menu.stage,
        action: () => onUpdateTasks({ stage }),
      })),
    },
    menu.allInToday
      ? {
          label: 'Remove from Today',
          icon: { icon: faSun, color: 'text-clover' },
          action: () => onUpdateTasks({ addedToToday: false }),
        }
      : {
          label: 'Add to Today',
          icon: { icon: faSunRegular, color: 'text-lichen' },
          action: () => onUpdateTasks({ addedToToday: true }),
        },
    {
      label: 'Set due date',
      icon: dueIcon(menu.due ?? null),
      value: menu.due && <span className="truncate text-sm text-moss/80">{formatDueDate(menu.due)}</span>,
      submenu: dueItems(menu, onUpdateTasks),
    },
    {
      label: 'Set priority',
      icon: priorityLabel(menu.priority ?? 'medium'),
      submenu: PRIORITIES.map((priority) => ({
        label: priorityLabel(priority).text,
        icon: priorityLabel(priority),
        checked: priority === menu.priority,
        action: () => onUpdateTasks({ priority }),
      })),
    },
    ...moveItems(menu.moveTargets, onUpdateTasks),
  ]

  const kindItems = menu.kind === RowKind.Task ? taskItems : []

  const renderItem = (item: MenuItem) => {
    if (item.pickDate)
      return (
        <PickDateItem
          key={item.label}
          onPick={(due) => {
            onUpdateTasks({ due })
            onClose()
          }}
        />
      )
    const submenu = item.submenu
    if (submenu)
      return (
        <SubmenuRow
          key={item.label}
          label={item.label}
          icon={item.icon}
          value={item.value}
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
      <MenuOption
        key={item.key ?? item.label}
        icon={item.icon}
        label={item.label}
        checked={item.checked}
        onClick={() => {
          item.action?.()
          onClose()
        }}
      />
    )
  }

  return (
    <Popover
      x={menu.x}
      y={menu.y}
      above={menu.above}
      width={rem(MENU_WIDTH)}
      title={sheet ? undefined : menu.title}
      onClose={onClose}
      onEscape={() => (sheet ? goBack() : onClose())}
    >
      <div ref={contentRef}>
        {sheet ? (
          <div key={sheet.label} className="fade-in">
            <div className="sticky -top-1 z-10 mx-2 mb-1 flex items-center border-b border-fieldstone bg-parchment py-1 sheet:top-0">
              <button aria-label="Back" onClick={goBack} className={ICON_BUTTON_CLASS + ' -ml-1 text-lichen'}>
                <FontAwesomeIcon icon={faArrowLeft} />
              </button>
              <p className="ml-[calc(var(--spacing-icon)-0.25rem)] font-serif text-lg font-medium text-moss">
                {sheet.label}
              </p>
            </div>
            {sheet.submenu.map(renderItem)}
          </div>
        ) : (
          <div className={mainClass}>
            {kindItems.map(renderItem)}
            {kindItems.length > 0 && <hr className="mx-2 my-1 border-fieldstone" />}
            <MenuOption
              icon={{ icon: faTrashCan }}
              label="Delete"
              danger
              onClick={() => {
                onDelete()
                onClose()
              }}
            />
          </div>
        )}
      </div>
    </Popover>
  )
}
