import { arrayMove } from '@dnd-kit/sortable'
import { RowKind, type Task, type TaskList } from './types'
import { isCompleted, moveAfterIncomplete } from './stages'
import { TODAY_LIST_ID, tasksInList } from './smartLists'

const moveById = <T extends { id: string }>(items: T[], activeId: string, overId: string): T[] => {
  const fromIndex = items.findIndex((item) => item.id === activeId)
  const toIndex = items.findIndex((item) => item.id === overId)
  return fromIndex < 0 || toIndex < 0 ? items : arrayMove(items, fromIndex, toIndex)
}

export type DropEvent = {
  selectedListId: string
  detailTaskId: string | null
  dragKind: RowKind | undefined
  activeId: string
  overId: string
}

export type ListsAndTasks = { lists: TaskList[]; tasks: Task[] }

// Reorder only within the container holding both the dragged item and the drop target.
export const applyDrop = (
  state: ListsAndTasks,
  { selectedListId, detailTaskId, dragKind, activeId, overId }: DropEvent,
): ListsAndTasks => {
  const { lists, tasks } = state
  if (activeId === overId) return state
  const isList = (id: string) => lists.some((list) => list.id === id)
  const visibleInList = tasksInList(tasks, selectedListId)

  if (dragKind === RowKind.Task && overId === TODAY_LIST_ID) {
    const task = visibleInList.find((task) => task.id === activeId)
    if (!task || task.addedToToday) return state
    return { lists, tasks: tasks.map((other) => (other === task ? { ...other, addedToToday: true } : other)) }
  }
  if (dragKind === RowKind.Task && isList(overId)) {
    const task = visibleInList.find((task) => task.id === activeId)
    if (!task || task.listId === overId) return state
    const moved = { ...task, listId: overId }
    const rest = tasks.filter((other) => other.id !== activeId)
    return { lists, tasks: isCompleted(moved.stage) ? moveAfterIncomplete([...rest, moved], moved.id, (other) => isCompleted(other.stage)) : [moved, ...rest] }
  }
  if (isList(activeId) && isList(overId)) return { lists: moveById(lists, activeId, overId), tasks }

  const containsBoth = (items: { id: string }[]) => items.some((item) => item.id === activeId) && items.some((item) => item.id === overId)
  if (containsBoth(visibleInList)) return { lists, tasks: moveById(tasks, activeId, overId) }
  const detailTask = visibleInList.find((task) => task.id === detailTaskId)
  if (detailTask && containsBoth(detailTask.steps)) {
    return { lists, tasks: tasks.map((task) => (task === detailTask ? { ...task, steps: moveById(task.steps, activeId, overId) } : task)) }
  }
  return state
}
