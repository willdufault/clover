import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MENU_CLASS, SHEET_TITLE_CLASS } from '../styles'
import { useModalFocus } from '../useModalFocus'

const MARGIN = 8

export const rem = (value: number) => value * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)

export const fit = (start: number, size: number, limit: number) =>
  Math.max(MARGIN, Math.min(start, limit - MARGIN - size))

export function Popover({
  x,
  y,
  above = y,
  width,
  title,
  focusFirst = false,
  onClose,
  onEscape = onClose,
  children,
}: {
  x: number
  y: number
  above?: number
  width: number
  title?: string
  focusFirst?: boolean
  onClose: () => void
  onEscape?: () => void
  children: React.ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useModalFocus(true)

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const height = panel.offsetHeight
    const top = y + height <= window.innerHeight - MARGIN ? y : above - height
    panel.style.top = fit(top, height, window.innerHeight) + 'px'
  })

  useEffect(() => {
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>('[aria-checked="true"], [role^="menuitem"]')
    ;(focusFirst ? first : panel)?.focus()
  }, [focusFirst])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onEscape()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40 sheet:bg-moss/20"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault()
          onClose()
        }}
      />
      <div
        ref={panelRef}
        role="menu"
        tabIndex={-1}
        className={
          'fixed z-50 outline-none ' +
          MENU_CLASS +
          ' pointer-coarse:max-h-96 pointer-coarse:overflow-x-hidden pointer-coarse:overflow-y-auto sheet:inset-x-0! sheet:top-auto! sheet:bottom-0 sheet:max-h-3/4 sheet:w-auto! sheet:rounded-b-none sheet:rounded-t-2xl sheet:border-x-0 sheet:border-b-0 sheet:px-2 sheet:pb-[calc(env(safe-area-inset-bottom)+1rem)]'
        }
        style={{ left: fit(x, width, window.innerWidth), width }}
      >
        <span aria-hidden className="mx-auto mt-1 mb-2 hidden h-1 w-10 rounded-full bg-fieldstone sheet:block" />
        {title && <p className={'hidden sheet:block ' + SHEET_TITLE_CLASS}>{title}</p>}
        {children}
      </div>
    </>,
    document.body,
  )
}
