import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { ICON_SLOT_CLASS } from '../styles'

export const IconSlot = ({ icon, color = '' }: { icon?: IconDefinition; color?: string }) => (
  <span className={ICON_SLOT_CLASS + ' ' + color}>{icon && <FontAwesomeIcon icon={icon} />}</span>
)
