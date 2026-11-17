import { useState } from 'react'
import { FIELD_CLASS } from '../styles'

export function AddInput({
  placeholder,
  maxLength,
  onAdd,
  className,
}: {
  placeholder: string
  maxLength: number
  onAdd: (text: string) => void
  className?: string
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
      maxLength={maxLength}
      className={FIELD_CLASS + ' border-dashed border-clover-400/70! bg-transparent! placeholder:text-clover-700! hover:border-clover-400! focus:border-solid focus:border-clover-400! focus:bg-paper!' + (className ? ' ' + className : '')}
    />
  )
}
