export function Count({ n }: { n: number }) {
  return n > 0 ? <span className="text-xs text-gray-500">{n}</span> : null
}
