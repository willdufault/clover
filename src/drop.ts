import { arrayMove } from '@dnd-kit/sortable'
import { today } from './due'
import { ItemType } from './shared'

export type Priority = 'low' | 'high'
export type Subtask = { id: string; text: string; done: boolean }
export type Task = { id: string; text: string; subtasks: Subtask[]; due?: string; priority?: Priority; stage?: 'progress' | 'waiting' | 'done' | 'cancelled'; listId?: string; today?: boolean }
export type TaskList = { id: string; name: string }

// Move a subtask right after the last open subtask.
export const moveSubtaskAfterLastOpen = (subtasks: Subtask[], id: string): Subtask[] => {
  const item = subtasks.find((subtask) => subtask.id === id)
  if (!item) return subtasks
  const rest = subtasks.filter((subtask) => subtask.id !== id)
  const lastOpen = rest.findLastIndex((subtask) => !subtask.done)
  return [...rest.slice(0, lastOpen + 1), item, ...rest.slice(lastOpen + 1)]
}

const move = <T extends { id: string }>(items: T[], activeId: string, overId: string): T[] => {
  const from = items.findIndex((item) => item.id === activeId)
  const to = items.findIndex((item) => item.id === overId)
  return from < 0 || to < 0 ? items : arrayMove(items, from, to)
}

export type Drop = {
  viewId: string
  selectedTaskId: string | null
  dragKind: ItemType | undefined
  activeId: string
  overId: string
}

export const ALL = 'all'

export const TODAY = 'today'

export const visibleTasks = (tasks: Task[], viewId: string, now = today()) =>
  viewId === ALL
    ? tasks
    : viewId === TODAY
      ? tasks.filter((task) => task.today || (task.due && task.due <= now))
      : tasks.filter((task) => task.listId === viewId)

export type State = { lists: TaskList[]; tasks: Task[] }

// Reorder only within the container that both the dragged item and its drop target belong to.
export const applyDrop = (
  state: State,
  { viewId, selectedTaskId, dragKind, activeId, overId }: Drop,
): State => {
  const { lists, tasks } = state
  if (activeId === overId) return state
  const isList = (id: string) => lists.some((list) => list.id === id)
  const visible = visibleTasks(tasks, viewId)

  if (dragKind === ItemType.Task && overId === TODAY) {
    const task = visible.find((task) => task.id === activeId)
    if (!task || task.today) return state
    return { lists, tasks: tasks.map((t) => (t === task ? { ...t, today: true } : t)) }
  }
  if (dragKind === ItemType.Task && isList(overId)) {
    const task = visible.find((task) => task.id === activeId)
    if (!task || task.listId === overId) return state
    return { lists, tasks: [{ ...task, listId: overId }, ...tasks.filter((t) => t.id !== activeId)] }
  }
  if (isList(activeId) && isList(overId)) return { lists: move(lists, activeId, overId), tasks }

  const has = (items: { id: string }[]) => items.some((t) => t.id === activeId) && items.some((t) => t.id === overId)
  if (has(visible)) return { lists, tasks: move(tasks, activeId, overId) }
  const parent = visible.find((task) => task.id === selectedTaskId)
  if (parent && has(parent.subtasks)) {
    return { lists, tasks: tasks.map((task) => (task === parent ? { ...task, subtasks: move(task.subtasks, activeId, overId) } : task)) }
  }
  return state
}
