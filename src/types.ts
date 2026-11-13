export type Priority = 'low' | 'medium' | 'high'
export type Stage = 'open' | 'inProgress' | 'waiting' | 'done' | 'cancelled'
export type Step = { id: string; text: string; completed: boolean }
export type Task = { id: string; text: string; steps: Step[]; due?: string; priority: Priority; stage: Stage; listId?: string; addedToToday?: boolean }
export type TaskList = { id: string; name: string }

export const RowKind = {
  List: 'list',
  Task: 'task',
  Step: 'step',
} as const
export type RowKind = (typeof RowKind)[keyof typeof RowKind]
