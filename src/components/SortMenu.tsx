import { useState } from 'react'
import type { SortCriteria } from '../sort'
import { MENU_CLASS, MENU_ITEM_CLASS } from '../styles'

const OPTIONS: [SortCriteria, string][] = [
  ['stage', 'Stage'],
  ['due', 'Due date'],
  ['priority', 'Priority'],
]

export function SortMenu({ onSort }: { onSort: (criteria: SortCriteria) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        aria-label="Sort"
        onClick={() => setOpen(true)}
        className="cursor-default rounded-full border border-line bg-paper px-3 py-1 text-sm text-ink-soft transition hover:border-clover-200 hover:text-clover-700"
      >
        ⇅ Sort
      </button>
      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <div className={"absolute left-0 z-50 mt-2 w-44 " + MENU_CLASS}>
            <p className="px-3 pt-1.5 pb-1 text-xs font-medium text-ink-soft">Sort by</p>
            {OPTIONS.map(([criteria, label]) => (
              <button
                key={criteria}
                onClick={() => {
                  onSort(criteria)
                  setOpen(false)
                }}
                className={"block text-ink " + MENU_ITEM_CLASS}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
