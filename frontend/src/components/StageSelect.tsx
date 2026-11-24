import { STAGES, stageLabel } from '../labels'
import { ignoreRowEvents } from './ignoreRowEvents'

export function StageSelect({ value, onChange }: { value: string; onChange: (stage: string) => void }) {
  return (
    <select
      value={value}
      title={stageLabel(value).label}
      {...ignoreRowEvents}
      onChange={(event) => onChange(event.target.value)}
      className="-m-2.5 size-11 shrink-0 cursor-pointer pointer-fine:m-0 pointer-fine:h-auto pointer-fine:w-6 appearance-none bg-transparent text-center text-base"
    >
      {STAGES.map((stage) => (
        <option key={stage} value={stage} title={stageLabel(stage).label}>
          {stageLabel(stage).emoji}
        </option>
      ))}
    </select>
  )
}
