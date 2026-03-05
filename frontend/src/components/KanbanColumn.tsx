import type { Task } from "../types/task"

type KanbanColumnProps = {
  title: string
  tasks: Task[]
  isFirst: boolean
  isLast: boolean
  onMoveLeft: (taskId: string) => void
  onMoveRight: (taskId: string) => void
}

export default function KanbanColumn({ title, tasks, isFirst, isLast, onMoveLeft, onMoveRight }: KanbanColumnProps) {
  return (
    <div className="w-64 shrink-0 bg-white rounded border flex flex-col">
      <div className="p-3 font-semibold border-b">{title}</div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {tasks.map(task => (
          <div key={task.id} className="bg-gray-50 border rounded p-2 flex flex-col gap-1">
            <span>{task.title}</span>
            <div className="flex gap-1">
              <button
                onClick={() => onMoveLeft(task.id)}
                disabled={isFirst}
                className="px-2 py-0.5 text-sm border rounded disabled:opacity-30"
              >
                ←
              </button>
              <button
                onClick={() => onMoveRight(task.id)}
                disabled={isLast}
                className="px-2 py-0.5 text-sm border rounded disabled:opacity-30"
              >
                →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
