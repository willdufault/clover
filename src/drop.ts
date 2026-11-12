import { arrayMove } from '@dnd-kit/sortable'
import { ItemKind, type Task, type TaskList } from './types'
import { moveAfterLastOpen } from './order'
import { TODAY_VIEW_ID, visibleTasks } from './views'

const moveById = <T extends { id: string }>(items: T[], activeId: string, overId: string): T[] => {
  const fromIndex = items.findIndex((item) => item.id === activeId)
  const toIndex = items.findIndex((item) => item.id === overId)
  return fromIndex < 0 || toIndex < 0 ? items : arrayMove(items, fromIndex, toIndex)
}

export type DropEvent = {
  viewId: string
  selectedTaskId: string | null
  dragKind: ItemKind | undefined
  activeId: string
  overId: string
}

export type BoardState = { lists: TaskList[]; tasks: Task[] }

// Reorder only within the container that both the dragged item and its drop target belong to.
export const applyDrop = (
  state: BoardState,
  { viewId, selectedTaskId, dragKind, activeId, overId }: DropEvent,
): BoardState => {
  const { lists, tasks } = state
  if (activeId === overId) return state
  const isList = (id: string) => lists.some((list) => list.id === id)
  const visibleInView = visibleTasks(tasks, viewId)

  if (dragKind === ItemKind.Task && overId === TODAY_VIEW_ID) {
    const task = visibleInView.find((task) => task.id === activeId)
    if (!task || task.addedToToday) return state
    return { lists, tasks: tasks.map((other) => (other === task ? { ...other, addedToToday: true } : other)) }
  }
  if (dragKind === ItemKind.Task && isList(overId)) {
    const task = visibleInView.find((task) => task.id === activeId)
    if (!task || task.listId === overId) return state
    const moved = { ...task, listId: overId }
    const isOpen = (other: Task) => other.stage !== 'done' && other.stage !== 'cancelled'
    const rest = tasks.filter((other) => other.id !== activeId)
    return { lists, tasks: isOpen(moved) ? [moved, ...rest] : moveAfterLastOpen([...rest, moved], moved.id, isOpen) }
  }
  if (isList(activeId) && isList(overId)) return { lists: moveById(lists, activeId, overId), tasks }

  const containsBoth = (items: { id: string }[]) => items.some((item) => item.id === activeId) && items.some((item) => item.id === overId)
  if (containsBoth(visibleInView)) return { lists, tasks: moveById(tasks, activeId, overId) }
  const selectedTask = visibleInView.find((task) => task.id === selectedTaskId)
  if (selectedTask && containsBoth(selectedTask.steps)) {
    return { lists, tasks: tasks.map((task) => (task === selectedTask ? { ...task, steps: moveById(task.steps, activeId, overId) } : task)) }
  }
  return state
}
