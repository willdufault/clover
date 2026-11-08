import { STAGE } from '../labels'
import type { Stage } from '../types'
import { stopDrag } from './stopDrag'

// Stage picker; showLabel adds the stage name after its emoji.
export function StageSelect({
  value,
  onChange,
  showLabel,
  className,
}: {
  value?: Stage
  onChange: (stage?: Stage) => void
  showLabel?: boolean
  className: string
}) {
  return (
    <select
      value={value ?? ''}
      {...stopDrag}
      onChange={(e) =>
        onChange((e.target.value || undefined) as Stage | undefined)
      }
      className={className}
    >
      <option value="">{showLabel ? '⬜ Open' : '⬜'}</option>
      {(Object.keys(STAGE) as Stage[]).map((stage) => (
        <option key={stage} value={stage}>
          {STAGE[stage].emoji}
          {showLabel && ' ' + STAGE[stage].label}
        </option>
      ))}
    </select>
  )
}
