import { STAGES, STAGE_LABELS } from '../labels'
import type { Stage } from '../types'
import { ignoreRowEvents } from './ignoreRowEvents'

const CHECK = <path d="M4 8.5 7 11l5-6" />
const CROSS = <path d="M5 5l6 6M11 5l-6 6" />

const MARK: Record<Stage, { className: string; icon?: React.ReactNode }> = {
  open: { className: 'border-clover-400 bg-paper' },
  inProgress: { className: 'border-clover-500 bg-[linear-gradient(to_top,var(--color-clover-200)_50%,var(--color-paper)_50%)]' },
  waiting: { className: 'border-dashed border-ink-faint bg-paper' },
  done: { className: 'border-clover-500 bg-clover-500 text-white', icon: CHECK },
  cancelled: { className: 'border-ink-faint bg-cream text-ink-soft', icon: CROSS },
}

function StageMark({ stage }: { stage: Stage }) {
  return (
    <span
      className={
        'flex size-5 items-center justify-center rounded-full border-2 transition ' +
        MARK[stage].className
      }
    >
      {MARK[stage].icon && (
        <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {MARK[stage].icon}
        </svg>
      )}
    </span>
  )
}

// A styled mark with an invisible native select on top.
export function StageSelect({
  value,
  onChange,
}: {
  value: Stage
  onChange: (stage: Stage) => void
}) {
  return (
    <span className="relative shrink-0 hover:brightness-95" title={STAGE_LABELS[value].label}>
      <StageMark stage={value} />
      <select
        value={value}
        {...ignoreRowEvents}
        onChange={(event) => onChange(event.target.value as Stage)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {STAGE_LABELS[stage].emoji + ' ' + STAGE_LABELS[stage].label}
          </option>
        ))}
      </select>
    </span>
  )
}
