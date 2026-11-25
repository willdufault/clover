import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDownWideShort, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { SortCriteria } from '../sort'
import { ICON_BUTTON_CLASS, MENU_ITEM_CLASS } from '../styles'
import { anchorOf, type Anchor } from './Picker'
import { Popover, rem } from './Popover'

const MENU_WIDTH = 14

const OPTIONS: [SortCriteria, string][] = [
  ['stage', 'Stage'],
  ['due', 'Due date'],
  ['priority', 'Priority'],
]

export function SortMenu({
  sort,
  onSort,
}: {
  sort: SortCriteria | null
  onSort: (criteria: SortCriteria | null) => void
}) {
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const close = () => setAnchor(null)
  const label = OPTIONS.find(([key]) => key === sort)?.[1]
  return (
    <>
      <button
        aria-label={label ? `Clear sort: ${label}` : 'Sort'}
        aria-haspopup={label ? undefined : 'menu'}
        aria-expanded={label ? undefined : !!anchor}
        onClick={(event) => (label ? onSort(null) : setAnchor(anchorOf(event)))}
        className={ICON_BUTTON_CLASS + ' -mr-2.5 h-9 w-auto gap-2 px-2.5 text-sm text-moss/80 aria-expanded:bg-moss/5'}
      >
        <FontAwesomeIcon
          icon={faArrowDownWideShort}
          className={'text-base ' + (label ? 'text-clover' : 'text-lichen')}
        />
        {label ? <span>{label}</span> : <span className="hidden sm:inline">Sort</span>}
        {label && <FontAwesomeIcon icon={faXmark} />}
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
          {OPTIONS.map(([criteria, optionLabel]) => (
            <button
              key={criteria}
              role="menuitem"
              onClick={() => {
                onSort(criteria)
                close()
              }}
              className={MENU_ITEM_CLASS}
            >
              {optionLabel}
            </button>
          ))}
        </Popover>
      )}
    </>
  )
}
