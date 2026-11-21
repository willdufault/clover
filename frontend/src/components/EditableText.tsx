import { useLayoutEffect, useRef, useState } from 'react'
import { ignoreRowEvents } from './ignoreRowEvents'

export function EditableText({
  tag: Tag,
  text,
  maxLength,
  editable = true,
  selectOnModifierClick = false,
  className,
  inputClassName,
  onCommit,
}: {
  tag: 'h1' | 'h2' | 'span'
  text: string
  maxLength: number
  editable?: boolean
  selectOnModifierClick?: boolean
  className: string
  inputClassName: string
  onCommit: (text: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  })

  if (draft !== null) {
    const cancel = () => setDraft(null)
    return (
      <textarea
        ref={ref}
        rows={1}
        autoFocus
        onFocus={(event) => event.target.select()}
        value={draft}
        maxLength={maxLength}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            const name = draft.trim()
            setDraft(null)
            if (name) onCommit(name)
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
        if (selectOnModifierClick && (event.ctrlKey || event.metaKey || event.shiftKey)) return
        event.stopPropagation()
        setDraft(text)
      }}
      className={className + (editable ? ' cursor-text' : '')}
    >
      {text}
    </Tag>
  )
}
