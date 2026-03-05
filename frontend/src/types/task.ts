import type { KanbanStage } from "./kanbanStage"

export type Task = {
  id: string
  title: string
}

export type TaskInfo = {
  task: Task
  stage: KanbanStage
}
