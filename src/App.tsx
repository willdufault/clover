import { useState } from 'react'
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
  ALL,
  TODAY,
  applyDrop,
  visibleTasks,
  moveSubtaskAfterLastOpen,
  type Priority,
  type Subtask,
  type Task,
  type TaskList,
} from './drop'
import { ItemType, type Stage } from './shared'
import ContextMenu, { type MenuState } from './components/ContextMenu'
import DetailPanel from './components/DetailPanel'
import Sidebar from './components/Sidebar'
import TaskView from './components/TaskView'
import { RenameInput } from './components/rows'

const seedLists: TaskList[] = [
  { id: 'groceries', name: 'Groceries' },
  { id: 'work', name: 'Work' },
  { id: 'home', name: 'Home' },
]

const seedTasks: Task[] = [
  {
    id: 'g1',
    text: 'Milk',
    listId: 'groceries',
    subtasks: [{ id: 'g1a', text: '2% lactose free', done: false }],
  },
  { id: 'g2', text: 'Eggs', listId: 'groceries', subtasks: [] },
  { id: 'w1', text: 'Reply to emails', listId: 'work', subtasks: [] },
  { id: 'w2', text: 'Update docs', listId: 'work', subtasks: [] },
  { id: 'w3', text: 'Review PR', listId: 'work', subtasks: [] },
]

export default function App() {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )
  const [lists, setLists] = useState(seedLists)
  const [tasks, setTasks] = useState(seedTasks)
  const [viewId, setViewId] = useState(seedLists[0].id)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ kind: ItemType; text: string } | null>(
    null,
  )
  const [dragOverListId, setDragOverListId] = useState<string | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [renaming, setRenaming] = useState<{
    kind: ItemType
    id: string
    draft: string
  } | null>(null)

  const viewTasks = visibleTasks(tasks, viewId)
  const viewName =
    viewId === ALL
      ? 'All'
      : viewId === TODAY
        ? 'Today'
        : lists.find((list) => list.id === viewId)?.name
  const selectedItem = viewTasks.find((task) => task.id === selectedTaskId)

  const select = (id: string) => {
    setViewId(id)
    setSelectedTaskId(null)
  }

  // Apply f to the subtasks of the task with id.
  const updateSubtasks = (
    taskId: string,
    f: (subtasks: Subtask[]) => Subtask[],
  ) =>
    setTasks((tasks) =>
      tasks.map((task) =>
        task.id === taskId ? { ...task, subtasks: f(task.subtasks) } : task,
      ),
    )

  const addTask = (text: string) =>
    setTasks((tasks) => [
      {
        id: crypto.randomUUID(),
        text,
        subtasks: [],
        listId: viewId === ALL || viewId === TODAY ? undefined : viewId,
        today: viewId === TODAY ? true : undefined,
      },
      ...tasks,
    ])

  const addSubtask = (text: string) =>
    updateSubtasks(selectedItem!.id, (subtasks) => [
      { id: crypto.randomUUID(), text, done: false },
      ...subtasks,
    ])

  const deleteTask = (id: string) =>
    setTasks((tasks) => tasks.filter((task) => task.id !== id))

  const patchTask = (id: string, patch: Partial<Task>) =>
    setTasks((tasks) =>
      tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    )

  const patchSubtask = (id: string, patch: Partial<Subtask>) =>
    updateSubtasks(selectedTaskId!, (subtasks) =>
      subtasks.map((subtask) =>
        subtask.id === id ? { ...subtask, ...patch } : subtask,
      ),
    )

  const renameTask = (id: string, text: string) => patchTask(id, { text })

  const toggleSubtask = (id: string) => {
    const done = !selectedItem!.subtasks.find((s) => s.id === id)!.done
    patchSubtask(id, { done })
    updateSubtasks(selectedTaskId!, (subtasks) =>
      moveSubtaskAfterLastOpen(subtasks, id),
    )
  }

  const deleteSubtask = (id: string) =>
    updateSubtasks(selectedTaskId!, (subtasks) =>
      subtasks.filter((subtask) => subtask.id !== id),
    )

  const renameSubtask = (id: string, text: string) =>
    patchSubtask(id, { text })

  const setDue = (id: string, due?: string) => patchTask(id, { due })

  const setPriority = (id: string, priority?: Priority) =>
    patchTask(id, { priority })

  const setStage = (id: string, stage?: Stage) => patchTask(id, { stage })

  const openMenu =
    (kind: ItemType, id: string, text: string, due?: string) =>
    (e: React.MouseEvent) => {
      e.preventDefault()
      setMenu({ x: e.clientX, y: e.clientY, kind, id, text, due })
    }

  const renameBox = (kind: ItemType, id: string, className: string) =>
    renaming?.kind === kind && renaming.id === id && (
      <RenameInput
        draft={renaming.draft}
        onChange={(draft) => setRenaming({ ...renaming, draft })}
        onCommit={commitRename}
        onCancel={() => setRenaming(null)}
        className={className}
      />
    )

  // Apply the in-progress rename (no-op on empty draft = cancel).
  const commitRename = () => {
    if (!renaming) return
    const { kind, id, draft } = renaming
    const name = draft.trim()
    setRenaming(null)
    if (!name) return
    if (kind === ItemType.List) {
      setLists(
        lists.map((list) => (list.id === id ? { ...list, name } : list)),
      )
    } else if (kind === ItemType.Task) {
      renameTask(id, name)
    } else {
      renameSubtask(id, name)
    }
  }

  const createList = (draft: string) => {
    const name = draft.trim()
    if (!name) return
    const newList = { id: crypto.randomUUID(), name }
    setLists([...lists, newList])
    select(newList.id)
  }

  const deleteList = (id: string) => {
    const remaining = lists.filter((list) => list.id !== id)
    const index = lists.findIndex((list) => list.id === id)
    setLists(remaining)
    setTasks(
      tasks.map((task) =>
        task.listId === id ? { ...task, listId: undefined } : task,
      ),
    )
    if (id === viewId) {
      select(
        remaining.length > 0 ? (remaining[index - 1] ?? remaining[0]).id : ALL,
      )
    }
  }

  // Remember what is being dragged so DragOverlay can render a floating clone.
  const onDragStart = ({ active }: DragStartEvent) => {
    setDrag(active.data.current as { kind: ItemType; text: string })
  }

  // Highlight the sidebar list row a task is hovering over.
  const onDragOver = ({ over }: DragOverEvent) => {
    const listIds = lists.map((list) => list.id)
    setDragOverListId(
      over &&
        drag?.kind === ItemType.Task &&
        [...listIds, TODAY].includes(String(over.id))
        ? String(over.id)
        : null,
    )
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDrag(null)
    setDragOverListId(null)
    if (!over) return
    const overId = String(over.id)
    const next = applyDrop({ lists, tasks }, {
      viewId,
      selectedTaskId,
      dragKind: drag?.kind,
      activeId: String(active.id),
      overId,
    })
    if (next.lists === lists && next.tasks === tasks) return
    setLists(next.lists)
    setTasks(next.tasks)
    if (
      drag?.kind === ItemType.Task &&
      (overId === TODAY || lists.some((list) => list.id === overId))
    )
      setSelectedTaskId(null)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDrag(null)
        setDragOverListId(null)
      }}
    >
      <div className="flex h-screen overflow-hidden flex-col font-sans">
        <header className="flex h-12 shrink-0 items-center bg-gray-200 px-4">
          <span className="font-semibold text-gray-800">todo</span>
        </header>
        <div className="flex flex-1 min-h-0">
          <Sidebar
            lists={lists}
            tasks={tasks}
            viewId={viewId}
            dragOverListId={dragOverListId}
            onSelect={select}
            onCreateList={createList}
            onContextMenu={openMenu}
            renameBox={renameBox}
          />
          <TaskView
            name={viewName}
            tasks={viewTasks}
            onAdd={addTask}
            onSelectTask={setSelectedTaskId}
            onSetStage={setStage}
            onContextMenu={openMenu}
            renameBox={renameBox}
          />
          {selectedItem && (
            <DetailPanel
              task={selectedItem}
              onClose={() => setSelectedTaskId(null)}
              onAddSubtask={addSubtask}
              onToggleSubtask={toggleSubtask}
              onSetStage={setStage}
              onSetDue={setDue}
              onSetPriority={setPriority}
              onContextMenu={openMenu}
              renameBox={renameBox}
            />
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
        <ContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onRename={() =>
            setRenaming({ kind: menu.kind, id: menu.id, draft: menu.text })
          }
          onDelete={() => {
            if (menu.kind === ItemType.List) deleteList(menu.id)
            else if (menu.kind === ItemType.Task) deleteTask(menu.id)
            else deleteSubtask(menu.id)
          }}
          onSetDue={(due) => setDue(menu.id, due)}
          onSetPriority={(p) => setPriority(menu.id, p)}
        />
      )}
    </DndContext>
  )
}
