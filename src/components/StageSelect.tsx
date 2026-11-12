import { STAGE_LABELS } from '../labels'
import type { Stage } from '../types'
import { ignoreRowEvents } from './ignoreRowEvents'

// Stage picker; the narrow width clips the closed select to the emoji.
export function StageSelect({
  value,
  onChange,
}: {
  value: Stage
  onChange: (stage: Stage) => void
}) {
  return (
    <select
      value={value}
      {...ignoreRowEvents}
      onChange={(event) => onChange(event.target.value as Stage)}
      className="w-5 shrink-0 appearance-none overflow-hidden bg-transparent"
    >
      {(Object.keys(STAGE_LABELS) as Stage[]).map((stage) => (
        <option key={stage} value={stage}>
          {STAGE_LABELS[stage].emoji + ' ' + STAGE_LABELS[stage].label}
        </option>
      ))}
    </select>
  )
}
