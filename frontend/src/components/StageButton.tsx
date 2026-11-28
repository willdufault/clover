import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { stageLabel } from '../labels'
import { ICON_SLOT_CLASS } from '../styles'
import { ignoreRowEvents } from './ignoreRowEvents'

export function StageButton({
  stage,
  onToggle,
  className = '',
}: {
  stage: string
  onToggle: () => void
  className?: string
}) {
  const label = stageLabel(stage)
  return (
    <button
      {...ignoreRowEvents}
      aria-label={stage === 'done' ? 'Mark open' : 'Mark done'}
      title={label.text}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className={`touch-hit h-6 cursor-pointer rounded-full transition active:scale-90 ${ICON_SLOT_CLASS} ${label.color} ${className}`}
    >
      <FontAwesomeIcon icon={label.icon} />
    </button>
  )
}
