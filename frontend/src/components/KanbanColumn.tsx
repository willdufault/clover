import type { Task } from "../types/Task"
import { PRIORITIES } from "../constants/priorities"

function isOverdue(dueDate: string): boolean {
  const [y, m, d] = dueDate.split("-").map(Number)
  const due = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

function getDueDateLabel(dueDate: string): string {
  const MS_PER_DAY = 86400000
  const [ys, ms, ds] = dueDate.split("-")
  const [y, m, d] = [Number(ys), Number(ms), Number(ds)]
  const due = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = (due.getTime() - today.getTime()) / MS_PER_DAY
  if (diff === -1) return "Due yesterday"
  if (diff === 0) return "Due today"
  if (diff === 1) return "Due tomorrow"
  return `Due ${ms}/${ds}/${y}`
}

type KanbanColumnProps = {
  title: string
  tasks: Task[]
  isFirst: boolean
  isLast: boolean
  onMoveLeft: (taskId: string) => void
  onMoveRight: (taskId: string) => void
  onTaskClick: (task: Task) => void
}

export default function KanbanColumn({ title, tasks, isFirst, isLast, onMoveLeft, onMoveRight, onTaskClick }: KanbanColumnProps) {
  return (
    <div className="w-64 shrink-0 bg-white rounded border flex flex-col">
      <div className="p-3 font-semibold border-b">{title}</div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {tasks.map(task => (
          <div
            key={task.id}
            className="bg-gray-50 border rounded p-2 flex flex-col gap-1 cursor-pointer hover:bg-gray-100"
            onClick={() => onTaskClick(task)}
          >
            <span className="break-words">{task.title}</span>
            {task.subtasks.length > 0 && (
              <span className="text-xs text-gray-400">
                {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} subtasks
              </span>
            )}
            {task.dueDate && (
              <span className={`text-xs ${isOverdue(task.dueDate) ? "text-red-500" : "text-gray-400"}`}>
                {getDueDateLabel(task.dueDate)}
              </span>
            )}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                <button
                  onClick={e => { e.stopPropagation(); onMoveLeft(task.id) }}
                  disabled={isFirst}
                  className="px-2 py-0.5 text-sm border rounded disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onMoveRight(task.id) }}
                  disabled={isLast}
                  className="px-2 py-0.5 text-sm border rounded disabled:opacity-30"
                >
                  →
                </button>
              </div>
              <span className={`text-xs font-medium ${
                task.priority === PRIORITIES.high ? "text-red-500" :
                task.priority === PRIORITIES.medium ? "text-amber-500" :
                "text-gray-400"
              }`}>
                {task.priority}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
