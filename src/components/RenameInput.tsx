import { stopDrag } from './stopDrag'

// In-place rename box: Enter commits, Escape or blur cancels.
export function RenameInput({
  draft,
  onChange,
  onCommit,
  onCancel,
  className,
  placeholder,
}: {
  draft: string
  onChange: (draft: string) => void
  onCommit: () => void
  onCancel: () => void
  className: string
  placeholder?: string
}) {
  return (
    <input
      placeholder={placeholder}
      autoFocus
      onFocus={(e) => e.target.select()}
      value={draft}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit()
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={onCancel}
      {...stopDrag}
      className={className}
    />
  )
}
