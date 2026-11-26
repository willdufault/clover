import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import type { Label } from '../labels'
import { MENU_ITEM_CLASS } from '../styles'
import { IconSlot } from './IconSlot'
import { Popover, rem } from './Popover'

const MENU_WIDTH = 13

export type Anchor = { rect: DOMRect; keyboard: boolean }

export const anchorOf = (event: React.MouseEvent<HTMLElement>): Anchor => ({
  rect: event.currentTarget.getBoundingClientRect(),
  keyboard: event.detail === 0,
})

export function Picker({
  name,
  title = `Set ${name.toLowerCase()}`,
  value,
  options,
  labelOf,
  showIcons = true,
  onChange,
  className,
  children,
}: {
  name: string
  title?: string
  value: string
  options: string[]
  labelOf: (option: string) => Label
  showIcons?: boolean
  onChange: (option: string) => void
  className: string
  children: React.ReactNode
}) {
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const close = () => setAnchor(null)
  return (
    <>
      <button
        aria-label={`${name}: ${labelOf(value).text}`}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(event) => setAnchor(anchorOf(event))}
        className={className}
      >
        {children}
      </button>
      {anchor && (
        <Popover
          x={anchor.rect.left}
          y={anchor.rect.bottom + 4}
          above={anchor.rect.top - 4}
          width={Math.max(rem(MENU_WIDTH), anchor.rect.width)}
          title={title}
          focusFirst={anchor.keyboard}
          onClose={close}
        >
          {options.map((option) => {
            const label = labelOf(option)
            return (
              <button
                key={option}
                role="menuitemradio"
                aria-checked={option === value}
                onClick={() => {
                  close()
                  if (option !== value) onChange(option)
                }}
                className={MENU_ITEM_CLASS}
              >
                {showIcons && <IconSlot icon={label.icon} color={label.color} />}
                <span title={label.text} className="min-w-0 flex-1 truncate">
                  {label.text}
                </span>
                {option === value && <FontAwesomeIcon icon={faCheck} className="text-clover" />}
              </button>
            )
          })}
        </Popover>
      )}
    </>
  )
}
