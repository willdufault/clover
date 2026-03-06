import { useState } from "react"
import type { TaskInfo } from "../types/Task"
import type { TaskPriority } from "../types/TaskPriority"
import { PRIORITIES } from "../constants/priorities"

type TaskModalProps = {
  taskInfo: TaskInfo
  onClose: () => void
  onAddSubtask: (title: string) => void
  onToggleSubtask: (subtaskId: string) => void
  onUpdatePriority: (priority: TaskPriority) => void
}

export default function TaskModal({ taskInfo, onClose, onAddSubtask, onToggleSubtask, onUpdatePriority }: TaskModalProps) {
  const { task, stage } = taskInfo
  const [newSubtaskTitle, setNewSubtaskTitle] = useState<string>("")

  function handleAddSubtask(): void {
    const trimmed = newSubtaskTitle.trim()
    if (!trimmed) return
    onAddSubtask(trimmed)
    setNewSubtaskTitle("")
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 relative flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl leading-none"
        >
          ×
        </button>
        <h2 className="text-lg font-semibold mb-1 break-words">{task.title}</h2>
        <div className="text-sm text-gray-500 mb-1">
          Stage: <span className="font-medium text-gray-700">{stage}</span>
        </div>
        <div className="text-sm text-gray-500 mb-4 flex items-center gap-2">
          Priority:
          <select
            value={task.priority}
            onChange={e => onUpdatePriority(e.target.value as TaskPriority)}
            className="font-medium text-gray-700 border rounded px-1 py-0.5 text-sm"
          >
            {Object.values(PRIORITIES).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
          {task.subtasks.map(subtask => (
            <label
              key={subtask.id}
              className="flex items-center gap-2 p-2 border rounded bg-gray-50 cursor-pointer hover:bg-gray-100"
            >
              <input
                type="checkbox"
                checked={subtask.completed}
                onChange={() => onToggleSubtask(subtask.id)}
                className="shrink-0"
              />
              <span className={subtask.completed ? "line-through text-gray-400 text-sm min-w-0 break-words" : "text-sm min-w-0 break-words"}>
                {subtask.title}
              </span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={newSubtaskTitle}
            onChange={e => setNewSubtaskTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAddSubtask()}
            className="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="New subtask..."
          />
          <button
            onClick={handleAddSubtask}
            className="px-3 py-1 text-sm bg-gray-800 text-white rounded"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
