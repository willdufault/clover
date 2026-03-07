import type { KanbanStage } from "./KanbanStage"
import type { TaskPriority } from "./TaskPriority"

export type Subtask = {
  id: string
  title: string
  completed: boolean
}

export type Task = {
  id: string
  title: string
  subtasks: Subtask[]
  priority: TaskPriority
  dueDate?: string
}

export type TaskInfo = {
  task: Task
  stage: KanbanStage
}
