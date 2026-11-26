export const STATIC_ROW_CLASS =
  'flex h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-base text-moss pointer-fine:h-10'

export const PROPERTY_ROW_CLASS =
  STATIC_ROW_CLASS + ' cursor-pointer transition hover:bg-moss/5 aria-expanded:bg-moss/5'

export const ICON_SLOT_CLASS = 'flex w-6 shrink-0 items-center justify-center'

export const RENAME_CLASS = 'field-sizing-content rounded-md border border-clover bg-parchment text-moss outline-none'

export const TITLE_RENAME_CLASS = 'max-w-full min-w-8 pr-8 font-serif font-medium ' + RENAME_CLASS

export const MENU_CLASS = 'rounded-lg border border-fieldstone bg-parchment p-1 text-base shadow-sm'

export const SHEET_TITLE_CLASS =
  'mx-2 mb-1 truncate border-b border-fieldstone px-1 pt-1 pb-3 font-serif text-lg font-medium text-moss'

export const MENU_ITEM_CLASS =
  'flex w-full cursor-pointer items-center gap-2.5 break-words rounded-md px-3 py-3 text-left text-moss -outline-offset-2 hover:bg-moss/5 aria-expanded:bg-moss/5 pointer-fine:py-2'

export const META_TEXT_CLASS = 'text-sm text-moss/80'

export const rowStateClass = (selected: boolean, menuTarget: boolean) => {
  if (selected || menuTarget) return 'bg-selection ring-1 ring-clover/30'
  return 'pointer-fine:hover:bg-parchment'
}

export const sidebarRowClass = (selected: boolean, dragOver: boolean, menuTarget = false) => {
  const base =
    'flex cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-3 py-3 text-base pointer-fine:py-1.5 '
  if (dragOver) return base + 'bg-clover/25 outline-2 outline-clover text-moss'
  if (selected) return base + 'bg-selection font-semibold text-moss'
  return base + 'text-moss/80 hover:text-moss ' + (menuTarget ? 'bg-selection' : 'pointer-fine:hover:bg-moss/5')
}

export const ICON_BUTTON_CLASS =
  'touch-hit flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full leading-none transition hover:bg-moss/5 hover:text-moss'

export const SAFE_AREA_CLASS =
  'pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]'

export const TRAILING_ICON_CLASS = 'size-7 text-sm text-lichen'
