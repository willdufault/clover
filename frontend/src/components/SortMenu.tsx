import { useState } from 'react'
import type { SortCriteria } from '../sort'
import { MENU_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '../styles'

const MENU_WIDTH = 176

const OPTIONS: [SortCriteria, string][] = [
  ['stage', 'Stage'],
  ['due', 'Due date'],
  ['priority', 'Priority'],
]

export function SortMenu({ onSort }: { onSort: (criteria: SortCriteria) => void }) {
  const [open, setOpen] = useState(false)
  const [flip, setFlip] = useState(false)
  return (
    <div className="relative">
      <button
        aria-label="Sort"
        onClick={(event) => {
          setFlip(event.currentTarget.getBoundingClientRect().left + MENU_WIDTH > window.innerWidth)
          setOpen(true)
        }}
        className="touch-hit cursor-default rounded-full border border-line bg-paper px-3 py-1 text-sm text-ink-soft transition hover:border-clover-200 hover:text-clover-700"
      >
        ⇅ Sort
      </button>
      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <div
            style={{ width: MENU_WIDTH }}
            className={'absolute z-50 mt-2 ' + MENU_CLASS + (flip ? ' right-0' : ' left-0')}
          >
            <p className={MENU_LABEL_CLASS}>Sort by</p>
            {OPTIONS.map(([criteria, label]) => (
              <button
                key={criteria}
                onClick={() => {
                  onSort(criteria)
                  setOpen(false)
                }}
                className={'block text-ink ' + MENU_ITEM_CLASS}
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
