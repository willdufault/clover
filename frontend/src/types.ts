export type Priority = 'low' | 'medium' | 'high'
export type Stage = 'open' | 'inProgress' | 'waiting' | 'done' | 'cancelled'
export type Step = { id: string; taskId: string; title: string; completed: boolean }
export type Task = { id: string; title: string; steps: Step[]; due: string | null; priority: Priority; stage: Stage; listId: string | null; addedToToday: boolean }
export type TaskList = { id: string; name: string }

export const RowKind = {
  List: 'list',
  Task: 'task',
  Step: 'step',
} as const
export type RowKind = (typeof RowKind)[keyof typeof RowKind]
