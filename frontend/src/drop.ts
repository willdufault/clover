import type { Task, TaskList } from './types'
import { TODAY_LIST_ID, tasksInList } from './smartLists'

const moveById = <T extends { id: string }>(items: T[], ids: string[], overId: string, after: boolean): T[] => {
  const over = items.find((item) => item.id === overId)
  const moved = items.filter((item) => ids.includes(item.id))
  if (!over || moved.length === 0 || ids.includes(overId)) return items
  const rest = items.filter((item) => !ids.includes(item.id))
  const to = rest.indexOf(over) + (after ? 1 : 0)
  return [...rest.slice(0, to), ...moved, ...rest.slice(to)]
}

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
  state: ListsAndTasks,
  { selectedListId, detailTask, activeId, dragIds = [activeId], overId, after }: DropEvent,
): ListsAndTasks => {
  const { lists, tasks } = state
  if (activeId === overId) return state
  const isListId = (id: string) => lists.some((list) => list.id === id)

  if (isListId(activeId) && isListId(overId)) return { lists: moveById(lists, [activeId], overId, after), tasks }

  const containsBoth = (items: { id: string }[]) =>
    items.some((item) => item.id === activeId) && items.some((item) => item.id === overId)
  if (containsBoth(tasksInList(tasks, selectedListId)))
    return { lists, tasks: moveById(tasks, dragIds, overId, !after) }
  if (detailTask && containsBoth(detailTask.steps)) {
    return {
      lists,
      tasks: tasks.map((task) =>
        task === detailTask ? { ...task, steps: moveById(task.steps, [activeId], overId, after) } : task,
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
