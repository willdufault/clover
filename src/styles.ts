import { isOverdue } from './dates'

export const FIELD_CLASS =
  'flex h-10 w-full items-center rounded-xl border border-line bg-paper px-3.5 text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-clover-400 focus:ring-3 focus:ring-clover-100'

export const TITLE_RENAME_CLASS =
  'field-sizing-content max-w-full min-w-8 rounded-lg pr-8 border border-clover-400 bg-paper font-semibold text-ink outline-none'

export const MENU_CLASS =
  'rounded-xl border border-line bg-paper p-1 text-sm shadow-[0_12px_32px_-8px_rgba(84,66,30,0.22)]'

export const MENU_ITEM_CLASS = 'w-full cursor-default rounded-lg px-3 py-2 text-left hover:bg-cream'

export const SELECTED_ROW_CLASS = 'bg-clover-100'

export const LABEL_CLASS =
  'mt-5 mb-2 px-1 text-xs font-semibold tracking-[0.07em] text-ink-soft uppercase'

export const sidebarRowClass = (selected: boolean, dragOver: boolean) => {
  const base =
    'flex select-none items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition '
  if (dragOver) return base + 'bg-clover-200 outline-2 outline-clover-400 text-ink'
  if (selected) return base + 'bg-paper font-semibold text-clover-700 shadow-[0_2px_8px_-3px_rgba(84,66,30,0.18)]'
  return base + 'text-ink-soft hover:bg-sprout-deep/60 hover:text-ink'
}

export const dueDateClass = (due: string) =>
  'text-[13.5px] ' + (isOverdue(due) ? 'text-coral' : 'text-ink-soft')

export const LIST_DOT_COLORS = ['#8fc575', '#f2b48c', '#b9a6e0', '#e8cf6a', '#8cc3dd', '#e99aa8']


export const X_BUTTON_CLASS =
  'flex size-7 shrink-0 items-center justify-center rounded-full text-sm leading-none text-ink-soft transition hover:bg-black/5 hover:text-ink'

export const listColor = (index: number) => LIST_DOT_COLORS[index % LIST_DOT_COLORS.length]
