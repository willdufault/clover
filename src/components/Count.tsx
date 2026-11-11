export function Count({ count }: { count: number }) {
  return count > 0 ? <span className="shrink-0 pl-3 text-xs text-gray-500">{count}</span> : null
}
