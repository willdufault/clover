import { useEffect, useRef, useState } from 'react'
import { ignoreRowEvents } from './ignoreRowEvents'

export function EditableText({
  tag: Tag,
  text,
  maxLength,
  editable = true,
  editRequest = 0,
  className,
  inputClassName,
  onCommit,
}: {
  tag: 'h1' | 'h2' | 'span'
  text: string
  maxLength: number
  editable?: boolean
  editRequest?: number
  className: string
  inputClassName: string
  onCommit: (text: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [seenRequest, setSeenRequest] = useState(editRequest)
  if (editRequest !== seenRequest) {
    setSeenRequest(editRequest)
    setDraft(text)
  }
  const editing = draft !== null
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  if (draft !== null) {
    const cancel = () => setDraft(null)
    return (
      <textarea
        rows={1}
        ref={inputRef}
        onFocus={(event) => event.target.select()}
        value={draft}
        maxLength={maxLength}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            const trimmed = draft.trim()
            setDraft(null)
            if (trimmed && trimmed !== text) onCommit(trimmed)
          }
          if (event.key === 'Escape') cancel()
        }}
        onBlur={cancel}
        onContextMenu={cancel}
        {...ignoreRowEvents}
        className={`${inputClassName} resize-none overflow-hidden break-words`}
      />
    )
  }

  return (
    <Tag
      onClick={(event) => {
        if (!editable) return
        event.stopPropagation()
        setDraft(text)
      }}
      className={className + (editable ? ' cursor-text' : '')}
    >
      {text}
    </Tag>
  )
}
