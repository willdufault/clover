import { useState } from 'react'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { IconSlot } from './IconSlot'

export function AddInput({
  placeholder,
  maxLength,
  onAdd,
  className = '',
}: {
  placeholder: string
  maxLength: number
  onAdd: (text: string) => void
  className?: string
}) {
  const [text, setText] = useState('')

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = text.trim()
        if (!trimmed) return
        onAdd(trimmed)
        setText('')
      }}
      className={
        'flex h-11 items-center gap-icon rounded-lg px-2 text-clover transition focus-within:bg-parchment focus-within:ring-1 focus-within:ring-fieldstone hover:bg-moss/5 pointer-fine:h-10 ' +
        className
      }
    >
      <IconSlot icon={faPlus} />
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={maxLength}
        className="min-w-0 flex-1 cursor-text bg-transparent text-base text-moss outline-none placeholder:text-moss/80"
      />
    </form>
  )
}
