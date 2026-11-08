import { useState } from 'react'
import { FIELD } from '../styles'

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
    onAdd(text)
    setText('')
  }

  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && add()}
      placeholder={placeholder}
      className={'mt-4 ' + FIELD}
    />
  )
}
