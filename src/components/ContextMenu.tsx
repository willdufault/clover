import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { nextMonday, today, tomorrow } from '../due'
import { STAGE_LABELS } from '../labels'
import { ItemKind, type Priority, type Stage } from '../types'

const MENU_WIDTH = 176

type MenuItem = { label: string; action?: () => void; danger?: boolean; submenu?: MenuItem[] }

function SubmenuRow({
  item,
  MenuList,
}: {
  item: MenuItem
  MenuList: (props: { items: MenuItem[] }) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [flip, setFlip] = useState(false)
  const [shift, setShift] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return setShift(0)
    setShift(Math.min(0, window.innerHeight - panelRef.current.getBoundingClientRect().bottom + shift))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
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
          <MenuList items={item.submenu!} />
        </div>
      )}
    </div>
  )
}

export type MenuState = {
  x: number
  y: number
  kind: ItemKind
  ids: string[]
  text: string
  due?: string
}

export type OpenMenu = (
  kind: ItemKind,
  id: string,
  text: string,
  due?: string,
) => (event: React.MouseEvent) => void

export default function ContextMenu({
  menu,
  onClose,
  onDelete,
  onSetDue,
  onSetPriority,
  onSetStage,
  onSetStepDone,
}: {
  menu: MenuState
  onClose: () => void
  onDelete: () => void
  onSetDue: (due?: string) => void
  onSetPriority: (priority?: Priority) => void
  onSetStage: (stage: Stage) => void
  onSetStepDone: (done: boolean) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(menu.y)
  useLayoutEffect(() => {
    setTop(Math.min(menu.y, window.innerHeight - ref.current!.offsetHeight))
  }, [menu.y])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const stageItem = (stages: Stage[], action: (stage: Stage) => void): MenuItem => ({
    label: 'Set stage',
    submenu: stages.map((stage) => ({
      label: STAGE_LABELS[stage].emoji + ' ' + STAGE_LABELS[stage].label,
      action: () => action(stage),
    })),
  })

  const taskItems: MenuItem[] = [
    stageItem(['open', 'inProgress', 'waiting', 'done', 'cancelled'], onSetStage),
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

  const MenuList = ({ items }: { items: MenuItem[] }) =>
    items.map((item) =>
      item.submenu ? (
        <SubmenuRow key={item.label} item={item} MenuList={MenuList} />
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
        {menu.kind === ItemKind.Task && (
          <>
            <MenuList items={taskItems} />
            <hr className="my-1 border-gray-200" />
          </>
        )}
        {menu.kind === ItemKind.Step && (
          <>
            <MenuList
              items={[stageItem(['open', 'done'], (stage) => onSetStepDone(stage === 'done'))]}
            />
            <hr className="my-1 border-gray-200" />
          </>
        )}
        <MenuList items={[{ label: 'Delete', action: onDelete, danger: true }]} />
      </div>
    </>
  )
}
