import { useState } from "react"
import { KANBAN_COLUMNS } from "../constants/kanbanColumns"
import { PRIORITIES } from "../constants/priorities"
import type { Task, TaskInfo, Subtask } from "../types/Task"
import type { TaskPriority } from "../types/TaskPriority"
import type { TaskList } from "../types/TaskList"
import KanbanColumn from "../components/KanbanColumn"
import TaskModal from "../components/TaskModal"

const DEFAULT_LIST_ID = crypto.randomUUID()
function makeEmptyColumns(): Task[][] { return KANBAN_COLUMNS.map(() => []) }

export default function KanbanPage() {
  const [lists, setLists] = useState<TaskList[]>([
    { id: DEFAULT_LIST_ID, name: "Tasks", columns: makeEmptyColumns() }
  ])
  const [activeListId, setActiveListId] = useState(DEFAULT_LIST_ID)
  const [newListName, setNewListName] = useState("")

  const activeList = lists.find(l => l.id === activeListId) ?? lists.find(l => l.id === DEFAULT_LIST_ID)!

  function setColumnTasks(updater: (prev: Task[][]) => Task[][]): void {
    setLists(prev => prev.map(list =>
      list.id === activeListId ? { ...list, columns: updater(list.columns) } : list
    ))
  }

  function addList(): void {
    const trimmed = newListName.trim()
    if (!trimmed) return
    setLists(prev => [...prev, { id: crypto.randomUUID(), name: trimmed, columns: makeEmptyColumns() }])
    setNewListName("")
  }
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

  function renameTask(taskId: string, title: string): void {
    setColumnTasks(prev => prev.map(col => col.map(task => task.id === taskId ? { ...task, title } : task)))
    if (selectedTask?.task.id === taskId) {
      setSelectedTask({ ...selectedTask, task: { ...selectedTask.task, title } })
    }
  }

  function renameSubtask(taskId: string, subtaskId: string, title: string): void {
    setColumnTasks(prev => prev.map(col => col.map(task =>
      task.id === taskId
        ? { ...task, subtasks: task.subtasks.map(s => s.id === subtaskId ? { ...s, title } : s) }
        : task
    )))
    if (selectedTask?.task.id === taskId) {
      setSelectedTask({ ...selectedTask, task: { ...selectedTask.task, subtasks: selectedTask.task.subtasks.map(s => s.id === subtaskId ? { ...s, title } : s) } })
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
        <div className="w-48 bg-white border-r flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {lists.map(list => (
              <button
                key={list.id}
                onClick={() => setActiveListId(list.id)}
                className={`w-full text-left text-sm px-2 py-1.5 rounded break-words ${
                  activeListId === list.id ? "bg-gray-200 font-medium" : "hover:bg-gray-100"
                }`}
              >
                {list.name}
              </button>
            ))}
          </div>
          <div className="border-t p-2 flex flex-col gap-1.5">
            <input
              type="text"
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addList()}
              className="w-full border rounded px-2 py-1 text-xs"
              placeholder="New list..."
            />
            <button
              onClick={addList}
              className="w-full py-1 text-xs bg-gray-800 text-white rounded"
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
                tasks={activeList.columns[colIndex]}
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
                onRenameTask={(title) => renameTask(selectedTask.task.id, title)}
                onRenameSubtask={(subtaskId, title) => renameSubtask(selectedTask.task.id, subtaskId, title)}
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
