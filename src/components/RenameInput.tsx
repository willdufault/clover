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
      onFocus={(event) => event.target.select()}
      value={draft}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onCommit()
        if (event.key === 'Escape') onCancel()
      }}
      onBlur={onCancel}
      {...stopDrag}
      className={className}
    />
  )
}
