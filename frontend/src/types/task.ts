import type { KanbanStage } from "./kanbanStage"

export type Subtask = {
  id: string
  title: string
  completed: boolean
}

export type Task = {
  id: string
  title: string
  subtasks: Subtask[]
}

export type TaskInfo = {
  task: Task
  stage: KanbanStage
}
