export type Step = { id: string; taskId: string; title: string; stage: string; order: number }
export type Task = {
  id: string
  title: string
  steps: Step[]
  due: string | null
  priority: string
  stage: string
  listId: string | null
  addedToToday: boolean
  order: number
}
export type TaskList = { id: string; name: string; order: number }
export type TaskPatch = Partial<Omit<Task, 'id' | 'steps'>>

export const RowKind = {
  List: 'list',
  Task: 'task',
  Step: 'step',
} as const
export type RowKind = (typeof RowKind)[keyof typeof RowKind]
