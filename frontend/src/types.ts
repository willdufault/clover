// TS widens JSON arrays to string[], so values from shared/enums.json can't be literal unions.
export type Priority = string
export type Stage = string
export type Step = { id: string; taskId: string; title: string; completed: boolean }
export type Task = {
  id: string
  title: string
  steps: Step[]
  due: string | null
  priority: Priority
  stage: Stage
  listId: string | null
  addedToToday: boolean
}
export type TaskList = { id: string; name: string }
export type TaskPatch = Partial<Omit<Task, 'id' | 'steps'>>

export const RowKind = {
  List: 'list',
  Task: 'task',
  Step: 'step',
} as const
export type RowKind = (typeof RowKind)[keyof typeof RowKind]
