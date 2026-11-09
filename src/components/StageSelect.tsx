import { STAGE_LABELS } from '../labels'
import type { Stage } from '../types'
import { stopDrag } from './stopDrag'

// Stage picker; className clips the closed select to the emoji by width.
export function StageSelect({
  value,
  onChange,
  className,
}: {
  value: Stage
  onChange: (stage: Stage) => void
  className: string
}) {
  return (
    <select
      value={value}
      {...stopDrag}
      onChange={(event) => onChange(event.target.value as Stage)}
      className={className}
    >
      {(Object.keys(STAGE_LABELS) as Stage[]).map((stage) => (
        <option key={stage} value={stage}>
          {STAGE_LABELS[stage].emoji + ' ' + STAGE_LABELS[stage].label}
        </option>
      ))}
    </select>
  )
}
