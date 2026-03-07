import type { Task } from "./Task"

export type TaskList = {
  id: string
  name: string
  columns: Task[][]
}
