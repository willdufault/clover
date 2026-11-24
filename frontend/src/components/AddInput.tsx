import { useState } from 'react'

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
    <form
      onSubmit={(event) => {
        event.preventDefault()
        add()
      }}
      className={className}
    >
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="flex h-11 w-full items-center rounded-xl border border-dashed border-clover-400/70 bg-transparent px-3.5 text-base text-ink pointer-fine:h-10 pointer-fine:text-sm outline-none transition placeholder:text-clover-700 hover:border-clover-400 focus:border-solid focus:border-clover-400 focus:bg-paper focus:ring-3 focus:ring-clover-100"
      />
    </form>
  )
}
