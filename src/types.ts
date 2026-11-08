export type Priority = 'low' | 'high'
export type Stage = 'progress' | 'waiting' | 'done' | 'cancelled'
export type Subtask = { id: string; text: string; done: boolean }
export type Task = { id: string; text: string; subtasks: Subtask[]; due?: string; priority?: Priority; stage?: Stage; listId?: string; today?: boolean }
export type TaskList = { id: string; name: string }

export const ItemType = {
  List: 'list',
  Task: 'task',
  Subtask: 'subtask',
} as const
export type ItemType = (typeof ItemType)[keyof typeof ItemType]
