import { STAGES, STAGE_LABELS } from '../labels'
import type { Stage } from '../types'
import { ignoreRowEvents } from './ignoreRowEvents'

export function StageSelect({ value, onChange }: { value: Stage; onChange: (stage: Stage) => void }) {
  return (
    <select
      value={value}
      title={STAGE_LABELS[value].label}
      {...ignoreRowEvents}
      onChange={(event) => onChange(event.target.value as Stage)}
      className="w-6 shrink-0 cursor-pointer appearance-none bg-transparent text-center text-base"
    >
      {STAGES.map((stage) => (
        <option key={stage} value={stage} title={STAGE_LABELS[stage].label}>
          {STAGE_LABELS[stage].emoji}
        </option>
      ))}
    </select>
  )
}
