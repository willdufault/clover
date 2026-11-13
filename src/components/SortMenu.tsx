import { useState } from 'react'
import type { SortCriteria } from '../sort'

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
        className="cursor-default rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
      >
        ⇅ Sort
      </button>
      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 w-44 rounded-md border border-gray-300 bg-white py-1 text-sm shadow-lg">
            {OPTIONS.map(([criteria, label]) => (
              <button
                key={criteria}
                onClick={() => {
                  onSort(criteria)
                  setOpen(false)
                }}
                className="block w-full cursor-default px-3 py-1.5 text-left text-gray-700 hover:bg-gray-100"
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
