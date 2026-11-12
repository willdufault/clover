import { useState } from 'react'
import { FIELD_CLASS } from '../styles'

// Text box that calls onAdd with non-blank text on Enter, then clears.
export function AddInput({
  placeholder,
  onAdd,
}: {
  placeholder: string
  onAdd: (text: string) => void
}) {
  const [text, setText] = useState('')

  const add = () => {
    if (!text.trim()) return
    onAdd(text.trim())
    setText('')
  }

  return (
    <input
      value={text}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => event.key === 'Enter' && add()}
      placeholder={placeholder}
      className={'mt-4 text-sm ' + FIELD_CLASS}
    />
  )
}
