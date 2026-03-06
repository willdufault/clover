import { useState } from "react"
import { KANBAN_COLUMNS } from "../constants/kanbanColumns"
import { PRIORITIES } from "../constants/priorities"
import type { Task, TaskInfo, Subtask } from "../types/Task"
import type { TaskPriority } from "../types/TaskPriority"
import KanbanColumn from "../components/KanbanColumn"
import TaskModal from "../components/TaskModal"

export default function KanbanPage() {
  const [columnTasks, setColumnTasks] = useState<Task[][]>(
    KANBAN_COLUMNS.map(() => [])
  )
  const [newTaskTitle, setNewTaskTitle] = useState<string>("")
  const [selectedTask, setSelectedTask] = useState<TaskInfo | null>(null)

  function addTask(): void {
    const trimmed = newTaskTitle.trim()
    if (!trimmed) return
    setColumnTasks((prev) => {
      const next = [...prev]
      next[0] = [
        { id: crypto.randomUUID(), title: trimmed, subtasks: [], priority: PRIORITIES.medium },
        ...next[0]
      ]
      return next
    })
    setNewTaskTitle("")
  }

  function addSubtask(taskId: string, title: string): void {
    const newSubtask = { id: crypto.randomUUID(), title, completed: false }
    setColumnTasks((prev) =>
      prev.map((col) =>
        col.map((task) =>
          task.id === taskId
            ? { ...task, subtasks: [...task.subtasks, newSubtask] }
            : task
        )
      )
    )
    if (selectedTask?.task.id === taskId) {
      setSelectedTask({ ...selectedTask, task: { ...selectedTask.task, subtasks: [...selectedTask.task.subtasks, newSubtask] } })
    }
  }

  function toggleSubtask(taskId: string, subtaskId: string): void {
    const sortedAfterToggle = (subtasks: Subtask[]): Subtask[] => {
      const toggled = subtasks.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s)
      const others = toggled.filter(s => s.id !== subtaskId)
      const insertAt = others.filter(s => !s.completed).length
      const pivot = toggled.find(s => s.id === subtaskId)!
      return [...others.slice(0, insertAt), pivot, ...others.slice(insertAt)]
    }
    setColumnTasks((prev) =>
      prev.map((col) =>
        col.map((task) =>
          task.id === taskId ? { ...task, subtasks: sortedAfterToggle(task.subtasks) } : task
        )
      )
    )
    if (selectedTask?.task.id === taskId) {
      setSelectedTask({ ...selectedTask, task: { ...selectedTask.task, subtasks: sortedAfterToggle(selectedTask.task.subtasks) } })
    }
  }

  function updatePriority(taskId: string, priority: TaskPriority): void {
    setColumnTasks((prev) =>
      prev.map((col) =>
        col.map((task) =>
          task.id === taskId ? { ...task, priority } : task
        )
      )
    )
    if (selectedTask?.task.id === taskId) {
      setSelectedTask({ ...selectedTask, task: { ...selectedTask.task, priority } })
    }
  }

  function updateDueDate(taskId: string, dueDate: string | undefined): void {
    setColumnTasks((prev) =>
      prev.map((col) =>
        col.map((task) =>
          task.id === taskId ? { ...task, dueDate } : task
        )
      )
    )
    if (selectedTask?.task.id === taskId) {
      setSelectedTask({ ...selectedTask, task: { ...selectedTask.task, dueDate } })
    }
  }

  function moveTask(
    taskId: string,
    fromColIndex: number,
    direction: -1 | 1
  ): void {
    const toColIndex = fromColIndex + direction
    if (toColIndex < 0 || toColIndex >= KANBAN_COLUMNS.length) return
    setColumnTasks((prev) => {
      const next = prev.map((col) => [...col])
      const task = next[fromColIndex].find((t) => t.id === taskId)!
      next[fromColIndex] = next[fromColIndex].filter((t) => t.id !== taskId)
      next[toColIndex] = [...next[toColIndex], task]
      return next
    })
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <div className="h-12 bg-white border-b flex items-center px-4">
        <span className="font-semibold">clover</span>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-48 bg-white border-r p-4">
          <span>sidebar</span>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 gap-4 p-4 overflow-x-auto">
            {KANBAN_COLUMNS.map((col, colIndex) => (
              <KanbanColumn
                key={col}
                title={col}
                tasks={columnTasks[colIndex]}
                isFirst={colIndex === 0}
                isLast={colIndex === KANBAN_COLUMNS.length - 1}
                onMoveLeft={(taskId) => moveTask(taskId, colIndex, -1)}
                onMoveRight={(taskId) => moveTask(taskId, colIndex, 1)}
                onTaskClick={(task) => setSelectedTask({ task, stage: col })}
              />
            ))}
            {selectedTask && (
              <TaskModal
                taskInfo={selectedTask}
                onClose={() => setSelectedTask(null)}
                onAddSubtask={(title) => addSubtask(selectedTask.task.id, title)}
                onToggleSubtask={(subtaskId) =>
                  toggleSubtask(selectedTask.task.id, subtaskId)
                }
                onUpdatePriority={(priority) => updatePriority(selectedTask.task.id, priority)}
                onUpdateDueDate={(dueDate) => updateDueDate(selectedTask.task.id, dueDate)}
              />
            )}
          </div>
          <div className="border-t bg-white p-3 flex gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              className="flex-1 border rounded px-2 py-1 text-sm"
              placeholder="New task..."
            />
            <button
              onClick={addTask}
              className="px-3 py-1 text-sm bg-gray-800 text-white rounded"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
