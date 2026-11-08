import { useEffect } from 'react'
import { nextMonday, today, tomorrow } from '../due'
import type { Priority } from '../drop'
import { ItemType } from '../shared'

export type MenuState = {
  x: number
  y: number
  kind: ItemType
  id: string
  text: string
  due?: string
}

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const item = (label: string, fn: () => void, danger?: boolean) => (
    <button
      key={label}
      onClick={() => {
        fn()
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
        onContextMenu={(e) => {
          e.preventDefault()
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
        {item('Rename', onRename)}
        {item('Delete', onDelete, true)}
        {menu.kind === ItemType.Task && (
          <>
            <hr className="my-1 border-gray-200" />
            {[
              ['Due today', today()],
              ['Due tomorrow', tomorrow()],
              ['Due next week', nextMonday()],
            ].map(([label, date]) => item(label, () => onSetDue(date)))}
            {menu.due && item('Remove due date', () => onSetDue())}
            <hr className="my-1 border-gray-200" />
            {(
              [
                ['Set low priority', 'low'],
                ['Set medium priority', undefined],
                ['Set high priority', 'high'],
              ] as const
            ).map(([label, p]) => item(label, () => onSetPriority(p)))}
          </>
        )}
      </div>
    </>
  )
}
