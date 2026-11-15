export function TaskCountBadge({ count }: { count: number }) {
  return count > 0 ? <span className="shrink-0 rounded-full bg-milk px-2 py-0.5 text-xs font-medium text-ink-soft tabular-nums">{count}</span> : null
}
