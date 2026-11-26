import { arrayMove } from '@dnd-kit/sortable'
import type { Task, TaskList } from './types'
import { TODAY_LIST_ID, tasksInList } from './smartLists'

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

export const applyDrop = (
  state: ListsAndTasks,
  { selectedListId, detailTask, activeId, overId }: DropEvent,
): ListsAndTasks => {
  const { lists, tasks } = state
  if (activeId === overId) return state
  const isListId = (id: string) => lists.some((list) => list.id === id)

  if (isListId(activeId) && isListId(overId)) return { lists: moveById(lists, activeId, overId), tasks }

  const containsBoth = (items: { id: string }[]) =>
    items.some((item) => item.id === activeId) && items.some((item) => item.id === overId)
  if (containsBoth(tasksInList(tasks, selectedListId))) return { lists, tasks: moveById(tasks, activeId, overId) }
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

export const idsToMove = (tasks: Task[], ids: string[], targetListId: string) =>
  tasks
    .filter((task) => ids.includes(task.id))
    .filter((task) => (targetListId === TODAY_LIST_ID ? !task.addedToToday : task.listId !== targetListId))
    .map((task) => task.id)
