import { useLayoutEffect, useRef } from 'react'
import { ignoreRowEvents } from './ignoreRowEvents'

// In-place rename box: Enter commits, Escape or blur cancels. Grows with its text.
export function RenameInput({
  draft,
  onChange,
  onCommit,
  onCancel,
  className,
}: {
  draft: string
  onChange: (draft: string) => void
  onCommit: () => void
  onCancel: () => void
  className: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current!
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft])
  return (
    <textarea
      ref={ref}
      rows={1}
      autoFocus
      onFocus={(event) => event.target.select()}
      value={draft}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          onCommit()
        }
        if (event.key === 'Escape') onCancel()
      }}
      onBlur={onCancel}
      {...ignoreRowEvents}
      className={`${className} resize-none overflow-hidden break-words`}
    />
  )
}
