import { useEffect, useRef } from 'react'

export const useModalFocus = <T extends HTMLElement>(active: boolean) => {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!active) return
    const previous = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => previous?.focus()
  }, [active])
  return ref
}
