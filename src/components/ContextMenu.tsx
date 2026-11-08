import { useEffect } from 'react'
import { nextMonday, today, tomorrow } from '../due'
import { ItemKind, type Priority } from '../types'

export type MenuState = {
  x: number
  y: number
  kind: ItemKind
  id: string
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
  onRename,
  onDelete,
  onSetDue,
  onSetPriority,
}: {
  menu: MenuState
  onClose: () => void
  onRename: () => void
  onDelete: () => void
  onSetDue: (due?: string) => void
  onSetPriority: (priority?: Priority) => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const menuItem = (label: string, action: () => void, danger?: boolean) => (
    <button
      key={label}
      onClick={() => {
        action()
        onClose()
      }}
      className={
        'block w-full cursor-default px-3 py-1.5 text-left hover:bg-gray-100 ' +
        (danger ? 'text-red-600' : 'text-gray-700')
      }
    >
      {label}
    </button>
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
        className="fixed z-50 max-h-64 w-44 overflow-y-auto rounded-md border border-gray-300 bg-white py-1 text-sm shadow-lg"
        style={{
          left: Math.min(menu.x, window.innerWidth - 176),
          top: Math.min(menu.y, window.innerHeight - 256),
        }}
      >
        {menuItem('Rename', onRename)}
        {menuItem('Delete', onDelete, true)}
        {menu.kind === ItemKind.Task && (
          <>
            <hr className="my-1 border-gray-200" />
            {[
              ['Due today', today()],
              ['Due tomorrow', tomorrow()],
              ['Due next week', nextMonday()],
            ].map(([label, date]) => menuItem(label, () => onSetDue(date)))}
            {menu.due && menuItem('Remove due date', () => onSetDue())}
            <hr className="my-1 border-gray-200" />
            {(
              [
                ['Set low priority', 'low'],
                ['Set medium priority', undefined],
                ['Set high priority', 'high'],
              ] as const
            ).map(([label, priority]) => menuItem(label, () => onSetPriority(priority)))}
          </>
        )}
      </div>
    </>
  )
}
