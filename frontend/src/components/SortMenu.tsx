import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDownWideShort, faCheck } from '@fortawesome/free-solid-svg-icons'
import type { Sort, SortCriteria } from '../sort'
import { ICON_BUTTON_CLASS, MENU_ITEM_CLASS } from '../styles'
import { anchorOf, type Anchor } from './Picker'
import { Popover, rem } from './Popover'

const MENU_WIDTH = 14

const OPTIONS: [SortCriteria | null, string, string, string][] = [
  [null, 'Manual', '', ''],
  ['stage', 'Stage', 'Open first', 'Waiting first'],
  ['due', 'Due date', 'Soonest first', 'Latest first'],
  ['priority', 'Priority', 'High first', 'Low first'],
]

const describe = (sort: Sort) => {
  const [, label = '', ascending = '', descending = ''] = OPTIONS.find(([key]) => key === sort.criteria) ?? []
  return { label, direction: sort.descending ? descending : ascending }
}

export function SortMenu({ sort, onSort }: { sort: Sort | null; onSort: (criteria: SortCriteria | null) => void }) {
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const close = () => setAnchor(null)
  const active = sort && describe(sort)
  const summary = active ? `${active.label}, ${active.direction.toLowerCase()}` : 'Sort'
  return (
    <>
      <button
        aria-label={active ? `Sort: ${summary}` : 'Sort'}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(event) => setAnchor(anchorOf(event))}
        className={ICON_BUTTON_CLASS + ' relative h-9 w-auto gap-2 px-2.5 text-sm text-moss/80 aria-expanded:bg-moss/5'}
      >
        <FontAwesomeIcon
          icon={faArrowDownWideShort}
          className={'text-base ' + (sort ? 'text-clover' : 'text-lichen')}
        />
        <span className="hidden sm:inline">{summary}</span>
        {active && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-clover sm:hidden" />}
      </button>
      {anchor && (
        <Popover
          x={anchor.rect.right - rem(MENU_WIDTH)}
          y={anchor.rect.bottom + 4}
          width={rem(MENU_WIDTH)}
          title="Sort by"
          focusFirst={anchor.keyboard}
          onClose={close}
        >
          {OPTIONS.map(([criteria, label]) => {
            const checked = (sort?.criteria ?? null) === criteria
            const detail = checked && active ? active.direction : ''
            return (
              <button
                key={label}
                role="menuitemradio"
                aria-checked={checked}
                aria-label={detail ? `${label}: ${detail}` : label}
                onClick={() => {
                  onSort(criteria)
                  close()
                }}
                className={MENU_ITEM_CLASS}
              >
                <span className="flex flex-1 flex-col">
                  {label}
                  {detail && (
                    <span className="text-sm text-moss/80">
                      <span className="pointer-coarse:hidden">Click to reverse</span>
                      <span className="hidden pointer-coarse:inline">Tap to reverse</span>
                    </span>
                  )}
                </span>
                {detail && <span className="text-sm text-moss/80">{detail}</span>}
                {checked && <FontAwesomeIcon icon={faCheck} className="text-clover" />}
              </button>
            )
          })}
        </Popover>
      )}
    </>
  )
}
