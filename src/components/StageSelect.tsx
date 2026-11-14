import { STAGES, STAGE_LABELS } from '../labels'
import type { Stage } from '../types'
import { ignoreRowEvents } from './ignoreRowEvents'

const MARK_CLASS = 'w-6 shrink-0 cursor-pointer appearance-none bg-transparent text-center text-base leading-none'

// Task stage: emoji-only select; the label shows as a tooltip.
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
      title={STAGE_LABELS[value].label}
      {...ignoreRowEvents}
      onChange={(event) => onChange(event.target.value as Stage)}
      className={MARK_CLASS}
    >
      {STAGES.map((stage) => (
        <option key={stage} value={stage} title={STAGE_LABELS[stage].label}>
          {STAGE_LABELS[stage].emoji}
        </option>
      ))}
    </select>
  )
}

// Step: same mark, toggles between open and done.
export function StepToggle({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  const stage = done ? 'done' : 'open'
  return (
    <button
      role="checkbox"
      aria-checked={done}
      title={STAGE_LABELS[stage].label}
      onPointerDown={ignoreRowEvents.onPointerDown}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className={MARK_CLASS}
    >
      {STAGE_LABELS[stage].emoji}
    </button>
  )
}
