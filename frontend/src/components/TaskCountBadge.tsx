export function TaskCountBadge({ count }: { count: number }) {
  return count > 0 ? <span className="shrink-0 text-sm text-moss/80 lining-nums tabular-nums">{count}</span> : null
}
