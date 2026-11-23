import { arrayMove } from '@dnd-kit/sortable'
import type { Task, TaskList } from './types'
import { tasksInList } from './smartLists'

const moveById = <T extends { id: string }>(items: T[], activeId: string, overId: string): T[] => {
  const fromIndex = items.findIndex((item) => item.id === activeId)
  const toIndex = items.findIndex((item) => item.id === overId)
  return fromIndex < 0 || toIndex < 0 ? items : arrayMove(items, fromIndex, toIndex)
}

type DropEvent = {
  selectedListId: string
  detailTask: Task | undefined
  activeId: string
  overId: string
}

export type ListsAndTasks = { lists: TaskList[]; tasks: Task[] }

// Local-only (not persisted). Reorder only within the container holding both the dragged item and the drop target.
export const applyDrop = (
  state: ListsAndTasks,
  { selectedListId, detailTask, activeId, overId }: DropEvent,
): ListsAndTasks => {
  const { lists, tasks } = state
  if (activeId === overId) return state
  const isList = (id: string) => lists.some((list) => list.id === id)
  const visibleInList = tasksInList(tasks, selectedListId)

  if (isList(activeId) && isList(overId)) return { lists: moveById(lists, activeId, overId), tasks }

  const containsBoth = (items: { id: string }[]) =>
    items.some((item) => item.id === activeId) && items.some((item) => item.id === overId)
  if (containsBoth(visibleInList)) return { lists, tasks: moveById(tasks, activeId, overId) }
  if (detailTask && containsBoth(detailTask.steps)) {
    return {
      lists,
      tasks: tasks.map((task) =>
        task === detailTask ? { ...task, steps: moveById(task.steps, activeId, overId) } : task,
      ),
    }
  }
  return state
}
