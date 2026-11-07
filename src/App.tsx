import { useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Task = { id: string; text: string; done: boolean; subtasks: Task[] }
type TaskList = { id: string; name: string; tasks: Task[] }

const seedLists: TaskList[] = [
  {
    id: 'groceries',
    name: 'Groceries',
    tasks: [
      {
        id: 'g1',
        text: 'Milk',
        done: false,
        subtasks: [
          { id: 'g1a', text: '2% lactose free', done: false, subtasks: [] },
        ],
      },
      { id: 'g2', text: 'Eggs', done: false, subtasks: [] },
    ],
  },
  {
    id: 'work',
    name: 'Work',
    tasks: [
      { id: 'w1', text: 'Reply to emails', done: false, subtasks: [] },
      { id: 'w2', text: 'Update docs', done: false, subtasks: [] },
      { id: 'w3', text: 'Review PR', done: false, subtasks: [] },
    ],
  },
  { id: 'home', name: 'Home', tasks: [] },
]

// Row that can be dragged among its SortableContext siblings.
function SortableRow({
  id,
  tag,
  className,
  onClick,
  onContextMenu,
  children,
}: {
  id: string
  tag: 'li' | 'div'
  className?: string
  onClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  const Tag = tag
  return (
    <Tag
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={isDragging ? 'opacity-60 shadow-lg ' + className : className}
      {...attributes}
      {...listeners}
    >
      {children}
    </Tag>
  )
}

// In-place rename box: Enter commits, Escape or blur cancels.
function RenameInput({
  draft,
  onChange,
  onCommit,
  onCancel,
  className,
}: {
  draft: string
  onChange: (draft: string) => void
  onCommit: () => void
  onCancel: () => void
  className: string
}) {
  return (
    <input
      autoFocus
      onFocus={(e) => e.target.select()}
      value={draft}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit()
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={onCancel}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={className}
    />
  )
}

// Apply f to the sibling array (tasks or subtasks) containing the item with id.
const updateById = (tasks: Task[], id: string, f: (items: Task[]) => Task[]): Task[] => {
  if (tasks.some((task) => task.id === id)) return f(tasks)
  return tasks.map((task) => ({ ...task, subtasks: updateById(task.subtasks, id, f) }))
}

export default function App() {
  const [lists, setLists] = useState(seedLists)
  const [selectedId, setSelectedId] = useState(seedLists[0].id)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ kind: 'list' | 'task' | 'subtask'; text: string } | null>(null)
  const [dragOverListId, setDragOverListId] = useState<string | null>(null)
  const [menu, setMenu] = useState<
    { x: number; y: number; kind: 'list' | 'task' | 'subtask'; id: string; text: string } | null
  >(null)
  const [renaming, setRenaming] = useState<
    { kind: 'list' | 'task' | 'subtask'; id: string; draft: string } | null
  >(null)
  const [text, setText] = useState('')
  const [subtaskText, setSubtaskText] = useState('')
  const [addingList, setAddingList] = useState(false)
  const [newListName, setNewListName] = useState('')

  const selectedList = lists.find((list) => list.id === selectedId)
  const selectedItem = selectedList?.tasks.find((task) => task.id === selectedItemId)

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu])

  const updateTasks = (listId: string, fn: (tasks: Task[]) => Task[]) => {
    setLists(lists.map((list) => (list.id === listId ? { ...list, tasks: fn(list.tasks) } : list)))
  }

  // Apply f to the task or subtask collection holding the item with id.
  const updateItem = (id: string, f: (items: Task[]) => Task[]) =>
    updateTasks(selectedId, (tasks) => updateById(tasks, id, f))

  const addTask = () => {
    if (!text.trim()) return
    updateTasks(selectedId, (tasks) => [
      { id: crypto.randomUUID(), text, done: false, subtasks: [] },
      ...tasks,
    ])
    setText('')
  }

  const addSubtask = () => {
    if (!subtaskText.trim() || !selectedItem) return
    updateItem(selectedItem.id, (subtasks) => [
      { id: crypto.randomUUID(), text: subtaskText, done: false, subtasks: [] },
      ...subtasks,
    ])
    setSubtaskText('')
  }

  // Move an item right after the last open (unchecked) item:
  // checked items land at the top of the done section,
  // unchecked items land at the bottom of the open section.
  const moveAfterLastOpen = (tasks: Task[], id: string): Task[] => {
    const item = tasks.find((task) => task.id === id)
    if (!item) return tasks
    const rest = tasks.filter((task) => task.id !== id)
    const lastOpen = rest.reduce((latestIndex, task, index) => (!task.done ? index : latestIndex), -1)
    return [
      ...rest.slice(0, lastOpen + 1),
      item,
      ...rest.slice(lastOpen + 1),
    ]
  }

  const toggleItem = (id: string) =>
    updateItem(id, (items) => {
      const flipped = items.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      )
      return moveAfterLastOpen(flipped, id)
    })

  const deleteItem = (id: string) =>
    updateItem(id, (items) => items.filter((item) => item.id !== id))

  // Shared row rendered by both the task list and the subtask panel.
  const taskRow = (item: Task, kind: 'task' | 'subtask', onToggle: () => void, onClick?: () => void) => (
    <SortableRow
      key={item.id}
      id={item.id}
      tag="li"
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenu({ x: e.clientX, y: e.clientY, kind, id: item.id, text: item.text })
      }}
      className={kind === 'task'
        ? 'group flex select-none items-center gap-3 border-b border-gray-100 py-2'
        : 'group flex select-none items-center gap-3 border-b border-gray-200 py-2'}
    >
      <input
        type="checkbox"
        checked={item.done}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggle}
        className="size-4 accent-blue-500"
      />
      {renaming?.kind === kind && renaming.id === item.id ? (
        <RenameInput
          draft={renaming.draft}
          onChange={(draft) => setRenaming({ ...renaming, draft })}
          onCommit={commitRename}
          onCancel={() => setRenaming(null)}
          className="min-w-0 flex-1 rounded border border-blue-400 bg-white px-1 py-0.5 text-sm text-gray-800 outline-none"
        />
      ) : (
        <span className={item.done ? 'text-gray-400 line-through' : 'text-gray-800'}>
          {item.text}
        </span>
      )}
    </SortableRow>
  )

  // Apply the in-progress rename (no-op on empty draft = cancel).
  const commitRename = () => {
    if (!renaming) return
    const { kind, id, draft } = renaming
    const name = draft.trim()
    setRenaming(null)
    if (!name) return
    if (kind === 'list') {
      setLists(lists.map((list) => (list.id === id ? { ...list, name } : list)))
    } else {
      updateItem(id, (items) => items.map((item) => (item.id === id ? { ...item, text: name } : item)))
    }
  }

  const createList = () => {
    const name = newListName.trim()
    setAddingList(false)
    setNewListName('')
    if (!name) return
    const newList = { id: crypto.randomUUID(), name, tasks: [] }
    setLists([...lists, newList])
    setSelectedId(newList.id)
    setSelectedItemId(null)
  }

  const deleteList = (id: string) => {
    const remaining = lists.filter((list) => list.id !== id)
    const index = lists.findIndex((list) => list.id === id)
    setLists(remaining)
    if (id === selectedId) {
      setSelectedItemId(null)
      if (remaining.length > 0) {
        setSelectedId((remaining[index - 1] ?? remaining[0]).id)
      }
    }
  }

  // Remember what is being dragged so DragOverlay can render a floating clone.
  const onDragStart = ({ active }: DragStartEvent) => {
    for (const list of lists) {
      if (list.id === String(active.id)) {
        setDrag({ kind: 'list', text: list.name })
        return
      }
      for (const task of list.tasks) {
        if (task.id === String(active.id)) {
          setDrag({ kind: 'task', text: task.text })
          return
        }
        const sub = task.subtasks.find((sub) => sub.id === String(active.id))
        if (sub) {
          setDrag({ kind: 'subtask', text: sub.text })
          return
        }
      }
    }
  }

  // Move a task to the front of another list.
  const moveTaskToList = (taskId: string, targetListId: string) => {
    if (!selectedList || selectedList.id === targetListId) return
    const task = selectedList.tasks.find((task) => task.id === taskId)
    if (!task) return
    setLists(lists.map((list) => {
      if (list.id === selectedList.id) return { ...list, tasks: list.tasks.filter((task) => task.id !== taskId) }
      if (list.id === targetListId) {
        const tasks = [task, ...list.tasks]
        return { ...list, tasks: task.done ? moveAfterLastOpen(tasks, taskId) : tasks }
      }
      return list
    }))
    setSelectedItemId(null)
  }

  // Highlight the sidebar list row a task is hovering over.
  const onDragOver = ({ over }: DragOverEvent) => {
    const listIds = lists.map((list) => list.id)
    setDragOverListId(
      over && drag?.kind === 'task' && listIds.includes(String(over.id)) ? String(over.id) : null,
    )
  }

  // Reorder only within the container (sidebar lists, main tasks and subtasks)
  // that both the dragged item and its drop target belong to.
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragOverListId(null)
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const overId = String(over.id)

    const listIds = lists.map((list) => list.id)
    if (drag?.kind === 'task' && listIds.includes(overId)) {
      moveTaskToList(activeId, overId)
      return
    }
    if (listIds.includes(activeId) && listIds.includes(overId)) {
      setLists(arrayMove(lists, listIds.indexOf(activeId), listIds.indexOf(overId)))
      return
    }
    if (!selectedList) return
    const taskIds = selectedList.tasks.map((task) => task.id)
    const subtaskIds =
      selectedList.tasks.find((task) => task.id === selectedItemId)?.subtasks.map((sub) => sub.id) ?? []
    if (taskIds.includes(activeId) && taskIds.includes(overId)) {
      updateTasks(selectedId, (tasks) =>
        arrayMove(tasks, taskIds.indexOf(activeId), taskIds.indexOf(overId)),
      )
    } else if (subtaskIds.includes(activeId) && subtaskIds.includes(overId)) {
      updateItem(selectedItemId!, (subtasks) =>
        arrayMove(subtasks, subtaskIds.indexOf(activeId), subtaskIds.indexOf(overId)),
      )
    }
    setDrag(null)
  }

  return (
    <DndContext
      sensors={useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDrag(null)
        setDragOverListId(null)
      }}
    >
      <div className="flex h-screen overflow-hidden flex-col font-sans">        <header className="flex h-12 shrink-0 items-center bg-gray-200 px-4">
          <span className="font-semibold text-gray-800">todo</span>
        </header>

        <div className="flex flex-1 min-h-0">
          <nav className="flex w-64 shrink-0 flex-col gap-1 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] border-r border-gray-200 bg-gray-100 p-3">
            <SortableContext items={lists} strategy={verticalListSortingStrategy}>
              {lists.map((list) => (
                <SortableRow
                  key={list.id}
                  id={list.id}
                  tag="div"
                  onClick={() => {
                    setSelectedId(list.id)
                    setSelectedItemId(null)
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setMenu({ x: e.clientX, y: e.clientY, kind: 'list', id: list.id, text: list.name })
                  }}
                  className={
                    list.id === dragOverListId
                      ? 'group flex select-none items-center rounded-md bg-blue-100 outline-2 outline-blue-300 px-3 py-1.5 text-left text-sm text-gray-800'
                      : list.id === selectedId
                      ? 'group flex select-none items-center rounded-md bg-gray-200 px-3 py-1.5 text-left text-sm font-medium text-gray-800'
                      : 'group flex select-none items-center rounded-md px-3 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-200/60'
                  }
                >
                  {renaming?.kind === 'list' && renaming.id === list.id ? (
                    <RenameInput
                      draft={renaming.draft}
                      onChange={(draft) => setRenaming({ ...renaming, draft })}
                      onCommit={commitRename}
                      onCancel={() => setRenaming(null)}
                      className="w-full min-w-0 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-sm font-medium text-gray-800 outline-none"
                    />
                  ) : (
                    <span className="truncate">{list.name}</span>
                  )}
                </SortableRow>
              ))}
            </SortableContext>

            {addingList ? (
              <input
                autoFocus
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createList()
                  if (e.key === 'Escape') {
                    setAddingList(false)
                    setNewListName('')
                  }
                }}
                onBlur={() => {
                  setAddingList(false)
                  setNewListName('')
                }}
                placeholder="List name…"
                className="mt-auto w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500"
              />
            ) : (
              <button
                onClick={() => setAddingList(true)}
                className="mt-auto rounded-md px-3 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-200/60"
              >
                + New list
              </button>
            )}
          </nav>

          <main className="flex-1 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] p-6">
            {!selectedList ? (
              <p className="text-sm text-gray-400">No lists yet — create one on the left</p>
            ) : (
              <>
                <h1 className="font-semibold text-gray-800">{selectedList.name}</h1>

                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTask()}
                  placeholder="Add a task and press Enter"
                  className="mt-4 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
                />

                <SortableContext
                  items={selectedList.tasks}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="mt-4 w-full">
                    {selectedList.tasks.map((task) =>
                      taskRow(task, 'task', () => toggleItem(task.id), () => setSelectedItemId(task.id))
                    )}
                  </ul>
                </SortableContext>

                {selectedList.tasks.length === 0 && (
                  <p className="mt-4 text-sm text-gray-400">No tasks yet</p>
                )}
              </>
            )}
          </main>

          {selectedItem && (
            <aside className="w-72 shrink-0 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] border-l border-gray-200 bg-gray-100 p-3">
              <div className="flex items-center">
                <h2 className="font-semibold text-gray-800">{selectedItem.text}</h2>
                <button
                  onClick={() => setSelectedItemId(null)}
                  className="ml-auto rounded text-gray-400 hover:text-gray-600"
                  aria-label="Close panel"
                >
                  ✕
                </button>
              </div>

              <input
                value={subtaskText}
                onChange={(e) => setSubtaskText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                placeholder="Add a subtask and press Enter"
                className="mt-4 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
              />

              <SortableContext
                items={selectedItem.subtasks}
                strategy={verticalListSortingStrategy}
              >
                <ul className="mt-4 w-full">
                  {selectedItem.subtasks.map((sub) =>
                    taskRow(sub, 'subtask', () => toggleItem(sub.id))
                  )}
                </ul>
              </SortableContext>

              {selectedItem.subtasks.length === 0 && (
                <p className="mt-4 text-sm text-gray-400">No subtasks yet</p>
              )}
            </aside>
          )}
        </div>
      </div>
      <DragOverlay>
        {drag && (
          <div className="cursor-default select-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-lg">
            {drag.text}
          </div>
        )}
      </DragOverlay>

      {menu && (
        <>
          {/* Invisible backdrop to catch clicks outside the menu. */}
          <div
            className="fixed inset-0"
            onClick={() => setMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault()
              setMenu(null)
            }}
          />
          <div
            className="fixed z-50 min-w-32 rounded-md border border-gray-300 bg-white py-1 text-sm shadow-lg"
            style={{ left: menu.x, top: menu.y }}
          >
            <button
              onClick={() => {
                setRenaming({ kind: menu.kind, id: menu.id, draft: menu.text })
                setMenu(null)
              }}
              className="block w-full cursor-default px-3 py-1.5 text-left text-gray-700 hover:bg-gray-100"
            >
              Rename
            </button>
            <button
              onClick={() => {
                if (menu.kind === 'list') deleteList(menu.id)
                else deleteItem(menu.id)
                setMenu(null)
              }}
              className="block w-full cursor-default px-3 py-1.5 text-left text-red-600 hover:bg-gray-100"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </DndContext>
  )
}
