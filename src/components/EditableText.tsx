import { useState } from 'react'
import { RenameInput } from './RenameInput'

export function EditableText({
  tag: Tag,
  text,
  editable = true,
  selectOnModifierClick = false,
  className,
  inputClassName,
  onCommit,
}: {
  tag: 'h1' | 'h2' | 'span'
  text: string
  editable?: boolean
  selectOnModifierClick?: boolean
  className: string
  inputClassName: string
  onCommit: (text: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  if (draft !== null) {
    const commit = () => {
      const name = draft.trim()
      setDraft(null)
      if (name) onCommit(name)
    }
    return (
      <RenameInput
        draft={draft}
        onChange={setDraft}
        onCommit={commit}
        onCancel={() => setDraft(null)}
        className={inputClassName}
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
