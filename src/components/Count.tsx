export function Count({ count }: { count: number }) {
  return count > 0 ? <span className="text-xs text-gray-500">{count}</span> : null
}
