import { useState } from "react"
import { KANBAN_COLUMNS, DEFAULT_STAGE } from "../constants/kanbanColumns"
import { PRIORITIES } from "../constants/priorities"
import type { Task, Subtask } from "../types/Task"
import type { TaskPriority } from "../types/TaskPriority"
import type { TaskList } from "../types/TaskList"
import KanbanColumn from "../components/KanbanColumn"
import TaskModal from "../components/TaskModal"

export default function KanbanPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [lists, setLists] = useState<TaskList[]>([])
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [newListName, setNewListName] = useState("")
  const [newTaskTitle, setNewTaskTitle] = useState<string>("")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const visibleTasks = activeListId === null
    ? tasks
    : tasks.filter(t => t.listId === activeListId)

  function addList(): void {
    const trimmed = newListName.trim()
    if (!trimmed) return
    setLists(prev => [...prev, { id: crypto.randomUUID(), name: trimmed }])
    setNewListName("")
  }

  function deleteList(listId: string): void {
    setLists(prev => prev.filter(l => l.id !== listId))
    if (activeListId === listId) setActiveListId(null)
  }

  function addTask(): void {
    const trimmed = newTaskTitle.trim()
    if (!trimmed) return
    setTasks(prev => [
      { id: crypto.randomUUID(), title: trimmed, subtasks: [], priority: PRIORITIES.medium, stage: DEFAULT_STAGE, listId: activeListId },
      ...prev
    ])
    setNewTaskTitle("")
  }

  function updateTask(taskId: string, updater: (t: Task) => Task): void {
    setTasks(prev => prev.map(t => t.id === taskId ? updater(t) : t))
    setSelectedTask(prev => prev?.id === taskId ? updater(prev) : prev)
  }

  function addSubtask(taskId: string, title: string): void {
    const newSubtask: Subtask = { id: crypto.randomUUID(), title, completed: false }
    updateTask(taskId, t => ({ ...t, subtasks: [...t.subtasks, newSubtask] }))
  }

  function toggleSubtask(taskId: string, subtaskId: string): void {
    const sortedAfterToggle = (subtasks: Subtask[]): Subtask[] => {
      const toggled = subtasks.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s)
      const others = toggled.filter(s => s.id !== subtaskId)
      const insertAt = others.filter(s => !s.completed).length
      const pivot = toggled.find(s => s.id === subtaskId)!
      return [...others.slice(0, insertAt), pivot, ...others.slice(insertAt)]
    }
    updateTask(taskId, t => ({ ...t, subtasks: sortedAfterToggle(t.subtasks) }))
  }

  function deleteTask(taskId: string): void {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setSelectedTask(null)
  }

  function deleteSubtask(taskId: string, subtaskId: string): void {
    updateTask(taskId, t => ({ ...t, subtasks: t.subtasks.filter(s => s.id !== subtaskId) }))
  }

  function moveTask(taskId: string, direction: -1 | 1): void {
    updateTask(taskId, t => {
      const i = KANBAN_COLUMNS.indexOf(t.stage)
      const nextIndex = i + direction
      if (nextIndex < 0 || nextIndex >= KANBAN_COLUMNS.length) return t
      return { ...t, stage: KANBAN_COLUMNS[nextIndex] }
    })
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <div className="h-12 bg-white border-b flex items-center px-4">
        <span className="font-semibold">clover</span>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-48 bg-white border-r flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            <button
              onClick={() => setActiveListId(null)}
              className={`w-full text-left text-sm px-2 py-1.5 rounded ${
                activeListId === null ? "bg-gray-200 font-medium" : "hover:bg-gray-100"
              }`}
            >
              Tasks
            </button>
            {lists.map(list => (
              <div
                key={list.id}
                onClick={() => setActiveListId(list.id)}
                className={`flex items-center w-full text-left text-sm px-2 py-1.5 rounded break-words cursor-pointer ${
                  activeListId === list.id ? "bg-gray-200 font-medium" : "hover:bg-gray-100"
                }`}
              >
                <span className="flex-1">{list.name}</span>
                <button
                  onClick={e => { e.stopPropagation(); deleteList(list.id) }}
                  className="ml-auto shrink-0 text-gray-400 hover:text-red-500"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
          <div className="border-t p-2 flex flex-col gap-1.5">
            <input
              type="text"
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addList()}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="New list..."
            />
            <button
              onClick={addList}
              className="w-full px-3 py-1 text-sm bg-gray-800 text-white rounded"
            >
              Add
            </button>
          </div>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 gap-4 p-4 overflow-x-auto">
            {KANBAN_COLUMNS.map((col, colIndex) => (
              <KanbanColumn
                key={col}
                title={col}
                tasks={visibleTasks.filter(t => t.stage === col)}
                isFirst={colIndex === 0}
                isLast={colIndex === KANBAN_COLUMNS.length - 1}
                onMoveLeft={(taskId) => moveTask(taskId, -1)}
                onMoveRight={(taskId) => moveTask(taskId, 1)}
                onTaskClick={(task) => setSelectedTask(task)}
              />
            ))}
            {selectedTask && (
              <TaskModal
                task={selectedTask}
                onClose={() => setSelectedTask(null)}
                onAddSubtask={(title) => addSubtask(selectedTask.id, title)}
                onToggleSubtask={(subtaskId) => toggleSubtask(selectedTask.id, subtaskId)}
                onUpdatePriority={(priority) => updateTask(selectedTask.id, t => ({ ...t, priority }))}
                onUpdateDueDate={(dueDate) => updateTask(selectedTask.id, t => ({ ...t, dueDate }))}
                onRenameTask={(title) => updateTask(selectedTask.id, t => ({ ...t, title }))}
                onRenameSubtask={(subtaskId, title) => updateTask(selectedTask.id, t => ({
                  ...t, subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, title } : s)
                }))}
                onDeleteTask={() => deleteTask(selectedTask.id)}
                onDeleteSubtask={(subtaskId) => deleteSubtask(selectedTask.id, subtaskId)}
                onMoveLeft={() => moveTask(selectedTask.id, -1)}
                onMoveRight={() => moveTask(selectedTask.id, 1)}
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
