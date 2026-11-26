import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { MENU_ITEM_CLASS } from '../styles'
import { IconSlot } from './IconSlot'

export type MenuIcon = { icon: IconDefinition; color?: string }

export function MenuOption({
  icon,
  label,
  checked,
  danger,
  onClick,
}: {
  icon?: MenuIcon
  label: string
  checked?: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked}
      onClick={onClick}
      className={MENU_ITEM_CLASS + (danger ? ' text-rosehip!' : '')}
    >
      {icon && <IconSlot icon={icon.icon} color={icon.color} />}
      <span title={label} className="min-w-0 flex-1 truncate">
        {label}
      </span>
      {checked && <FontAwesomeIcon icon={faCheck} className="text-clover" />}
    </button>
  )
}
