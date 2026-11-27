import { RowKind, type Task, type TaskList } from './types'
import { TODAY_LIST_ID, tasksInList } from './smartLists'

const moveById = <T extends { id: string }>(items: T[], ids: string[], overId: string, after: boolean): T[] => {
  const over = items.find((item) => item.id === overId)
  const moved = items.filter((item) => ids.includes(item.id))
  if (!over || moved.length === 0 || ids.includes(overId)) return items
  const rest = items.filter((item) => !ids.includes(item.id))
  const to = rest.indexOf(over) + (after ? 1 : 0)
  return [...rest.slice(0, to), ...moved, ...rest.slice(to)]
}

type Ordered = { id: string; order: number }

const has = (items: { id: string }[], id: string) => items.some((item) => item.id === id)

type DropEvent = {
  selectedListId: string
  detailTask: Task | undefined
  activeId: string
  dragIds?: string[]
  overId: string
  after: boolean
}

export type ListsAndTasks = { lists: TaskList[]; tasks: Task[] }

export const applyDrop = (
  { lists, tasks }: ListsAndTasks,
  { selectedListId, detailTask, activeId, dragIds = [activeId], overId, after }: DropEvent,
) => {
  const groups = [
    { kind: RowKind.List, items: lists as Ordered[], ids: [activeId], after },
    { kind: RowKind.Task, items: tasksInList(tasks, selectedListId), ids: dragIds, after: !after },
    { kind: RowKind.Step, items: detailTask?.steps ?? [], ids: [activeId], after },
  ]
  const group = groups.find(({ items }) => has(items, activeId) && has(items, overId))
  if (!group) return null
  const items = moveById(group.items, group.ids, overId, group.after)
  return items === group.items ? null : { kind: group.kind, items }
}

export const orderPatches = (items: Ordered[]) =>
  items.flatMap((item, order) => (item.order === order ? [] : [{ id: item.id, order }]))

export const idsToMove = (tasks: Task[], ids: string[], targetListId: string) =>
  tasks
    .filter((task) => ids.includes(task.id))
    .filter((task) => (targetListId === TODAY_LIST_ID ? !task.addedToToday : task.listId !== targetListId))
    .map((task) => task.id)

export const movedToList = (tasks: Task[], ids: string[], listId: string) => {
  const lowest = Math.min(0, ...tasksInList(tasks, listId).map((task) => task.order))
  return ids.map((id, i) => ({ id, listId, order: lowest - ids.length + i }))
}
