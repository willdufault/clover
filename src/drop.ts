import { arrayMove } from '@dnd-kit/sortable'

export type Task = { id: string; text: string; done: boolean; subtasks: Task[]; due?: string; priority?: 'low' | 'high'; stage?: 'progress' | 'waiting' | 'done' | 'cancelled' }
export type TaskList = { id: string; name: string; tasks: Task[] }

// Move an item right after the last open (unchecked) item:
// checked items land at the top of the done section,
// unchecked items land at the bottom of the open section.
export const moveAfterLastOpen = (tasks: Task[], id: string): Task[] => {
  const item = tasks.find((task) => task.id === id)
  if (!item) return tasks
  const rest = tasks.filter((task) => task.id !== id)
  const lastOpen = rest.reduce((latestIndex, task, index) => (!task.done ? index : latestIndex), -1)
  return [...rest.slice(0, lastOpen + 1), item, ...rest.slice(lastOpen + 1)]
}

const move = <T extends { id: string }>(items: T[], activeId: string, overId: string): T[] => {
  const from = items.findIndex((item) => item.id === activeId)
  const to = items.findIndex((item) => item.id === overId)
  return from < 0 || to < 0 ? items : arrayMove(items, from, to)
}

export type Drop = {
  selectedId: string
  selectedItemId: string | null
  dragKind: 'list' | 'task' | 'subtask' | undefined
  activeId: string
  overId: string
}

// Reorder only within the container that both the dragged item and its drop target belong to.
export const applyDrop = (
  lists: TaskList[],
  { selectedId, selectedItemId, dragKind, activeId, overId }: Drop,
): TaskList[] => {
  if (activeId === overId) return lists
  const isList = (id: string) => lists.some((list) => list.id === id)
  const selected = lists.find((list) => list.id === selectedId)

  if (dragKind === 'task' && isList(overId)) {
    const task = selected?.tasks.find((task) => task.id === activeId)
    if (!selected || !task || selected.id === overId) return lists
    return lists.map((list) => {
      if (list.id === selected.id) return { ...list, tasks: list.tasks.filter((t) => t.id !== activeId) }
      if (list.id === overId) {
        const tasks = [task, ...list.tasks]
        return { ...list, tasks: task.done ? moveAfterLastOpen(tasks, activeId) : tasks }
      }
      return list
    })
  }
  if (isList(activeId) && isList(overId)) return move(lists, activeId, overId)
  if (!selected) return lists

  const has = (items: Task[]) => items.some((t) => t.id === activeId) && items.some((t) => t.id === overId)
  if (has(selected.tasks)) {
    return lists.map((list) => (list === selected ? { ...list, tasks: move(list.tasks, activeId, overId) } : list))
  }
  const parent = selected.tasks.find((task) => task.id === selectedItemId)
  if (parent && has(parent.subtasks)) {
    const tasks = selected.tasks.map((task) =>
      task === parent ? { ...task, subtasks: move(task.subtasks, activeId, overId) } : task,
    )
    return lists.map((list) => (list === selected ? { ...list, tasks } : list))
  }
  return lists
}
