import { isOverdue } from './due'

export const FIELD_CLASS =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500'

export const navRowClass = (selected: boolean, dragOver: boolean) => {
  const base =
    'flex select-none items-center justify-between rounded-md px-3 py-1.5 text-left text-sm '
  if (dragOver) return base + 'bg-blue-100 outline-2 outline-blue-300 text-gray-800'
  if (selected) return base + 'bg-gray-200 font-medium text-gray-800'
  return base + 'text-gray-600 hover:bg-gray-200/60'
}

export const dueClass = (due: string) =>
  'text-xs ' + (isOverdue(due) ? 'text-red-600' : 'text-gray-500')
