import { useState } from "react"
import type { Task } from "../types/Task"
import type { TaskPriority } from "../types/TaskPriority"
import { PRIORITIES } from "../constants/priorities"
import { KANBAN_COLUMNS } from "../constants/kanbanColumns"

type TaskModalProps = {
  task: Task
  onClose: () => void
  onAddSubtask: (title: string) => void
  onToggleSubtask: (subtaskId: string) => void
  onUpdatePriority: (priority: TaskPriority) => void
  onUpdateDueDate: (dueDate: string | undefined) => void
  onRenameTask: (title: string) => void
  onRenameSubtask: (subtaskId: string, title: string) => void
  onDeleteTask: () => void
  onDeleteSubtask: (subtaskId: string) => void
  onMoveLeft: () => void
  onMoveRight: () => void
}

export default function TaskModal({ task, onClose, onAddSubtask, onToggleSubtask, onUpdatePriority, onUpdateDueDate, onRenameTask, onRenameSubtask, onDeleteTask, onDeleteSubtask, onMoveLeft, onMoveRight }: TaskModalProps) {
  const stageIndex = KANBAN_COLUMNS.indexOf(task.stage)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState<string>("")
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.title)
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null)
  const [subtaskDraft, setSubtaskDraft] = useState("")

  function commitTitleEdit(): void {
    const trimmed = titleDraft.trim()
    if (trimmed) onRenameTask(trimmed)
    setEditingTitle(false)
  }

  function commitSubtaskEdit(): void {
    const trimmed = subtaskDraft.trim()
    if (trimmed && editingSubtaskId) onRenameSubtask(editingSubtaskId, trimmed)
    setEditingSubtaskId(null)
  }

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
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 relative flex flex-col max-h-[70vh]"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl leading-none"
        >
          ×
        </button>
        {editingTitle ? (
          <input
            autoFocus
            className="text-lg font-semibold mb-1 w-full border-b border-gray-400 outline-none bg-transparent"
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitTitleEdit}
            onKeyDown={e => {
              if (e.key === "Enter") commitTitleEdit()
              if (e.key === "Escape") { setTitleDraft(task.title); setEditingTitle(false) }
            }}
          />
        ) : (
          <h2
            className="text-lg font-semibold mb-1 break-words cursor-pointer hover:underline decoration-dotted"
            onClick={() => { setTitleDraft(task.title); setEditingTitle(true) }}
          >
            {task.title}
          </h2>
        )}
        <div className="mb-1">
          <div className="text-sm text-gray-500">
            Stage: <span className="font-medium text-gray-700">{task.stage}</span>
          </div>
          <div className="flex gap-1 mt-1">
            <button
              onClick={onMoveLeft}
              disabled={stageIndex === 0}
              className="px-2 py-0.5 text-sm border rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ←
            </button>
            <button
              onClick={onMoveRight}
              disabled={stageIndex === KANBAN_COLUMNS.length - 1}
              className="px-2 py-0.5 text-sm border rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>
        </div>
        <div className="text-sm text-gray-500 mb-1 flex items-center gap-2">
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
        <div className="text-sm text-gray-500 mb-4 flex items-center gap-2">
          Due date:
          <input
            type="date"
            value={task.dueDate ?? ""}
            onChange={e => onUpdateDueDate(e.target.value || undefined)}
            className="font-medium text-gray-700 border rounded px-1 py-0.5 text-sm"
          />
        </div>
        <button
          onClick={onDeleteTask}
          className="text-sm text-red-500 hover:text-red-700 self-start mb-3 border border-red-300 hover:border-red-500 rounded px-2 py-0.5"
        >
          🗑️ delete
        </button>
        <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
          {task.subtasks.map(subtask => (
            <div
              key={subtask.id}
              className="flex items-center gap-2 p-2 border rounded bg-gray-50 cursor-pointer hover:bg-gray-100"
              onClick={() => { if (editingSubtaskId !== subtask.id) { setEditingSubtaskId(subtask.id); setSubtaskDraft(subtask.title) } }}
            >
              <input
                type="checkbox"
                checked={subtask.completed}
                onChange={() => onToggleSubtask(subtask.id)}
                onClick={e => e.stopPropagation()}
                className="shrink-0 cursor-pointer"
              />
              {editingSubtaskId === subtask.id ? (
                <input
                  autoFocus
                  className="flex-1 text-sm border-b border-gray-400 outline-none bg-transparent min-w-0"
                  value={subtaskDraft}
                  onChange={e => setSubtaskDraft(e.target.value)}
                  onBlur={commitSubtaskEdit}
                  onKeyDown={e => {
                    if (e.key === "Enter") commitSubtaskEdit()
                    if (e.key === "Escape") setEditingSubtaskId(null)
                  }}
                />
              ) : (
                <span
                  className={subtask.completed ? "flex-1 line-through text-gray-400 text-sm min-w-0 break-words" : "flex-1 text-sm min-w-0 break-words"}
                >
                  {subtask.title}
                </span>
              )}
              <button
                onClick={e => { e.stopPropagation(); onDeleteSubtask(subtask.id) }}
                className="ml-auto shrink-0 text-gray-400 hover:text-red-500"
              >
                🗑️
              </button>
            </div>
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
