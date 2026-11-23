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
      className="-m-2.5 size-11 shrink-0 cursor-pointer pointer-fine:m-0 pointer-fine:h-auto pointer-fine:w-6 appearance-none bg-transparent text-center text-base"
    >
      {STAGES.map((stage) => (
        <option key={stage} value={stage} title={STAGE_LABELS[stage].label}>
          {STAGE_LABELS[stage].emoji}
        </option>
      ))}
    </select>
  )
}
