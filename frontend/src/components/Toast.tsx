import { useEffect } from 'react'

export type ToastState = { text: string; undo: () => void }

export function Toast({ toast, setToast }: { toast: ToastState | null; setToast: (toast: null) => void }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast, setToast])
  if (!toast) return null
  return (
    <div
      role="status"
      className="pointer-events-auto mb-4 flex items-center gap-4 rounded-lg bg-moss py-2 pr-2 pl-4 text-base text-parchment shadow-sm"
    >
      {toast.text}
      <button
        onClick={() => {
          toast.undo()
          setToast(null)
        }}
        className="touch-hit cursor-pointer rounded-md px-3 py-1.5 font-medium text-parchment hover:bg-parchment/10 focus-visible:outline-parchment"
      >
        Undo
      </button>
    </div>
  )
}
