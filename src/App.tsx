import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { applyDrop } from './drop'
import { SEED_LISTS, SEED_TASKS } from './seed'
import { moveAfterLastOpen } from './order'
import { ItemKind, type Stage, type Subtask, type Task } from './types'
import { ALL_VIEW_ID, TODAY_VIEW_ID, visibleTasks } from './views'
import ContextMenu, { type MenuState } from './components/ContextMenu'
import DetailPanel from './components/DetailPanel'
import Sidebar from './components/Sidebar'
import TaskView from './components/TaskView'
import { RenameInput } from './components/RenameInput'

export default function App() {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )
  const [lists, setLists] = useState(SEED_LISTS)
  const [tasks, setTasks] = useState(SEED_TASKS)
  const [viewId, setViewId] = useState(SEED_LISTS[0].id)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [activeDrag, setActiveDrag] = useState<{ kind: ItemKind; text: string } | null>(
    null,
  )
  const [dragOverViewId, setDragOverViewId] = useState<string | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [renaming, setRenaming] = useState<{
    kind: ItemKind
    id: string
    draft: string
  } | null>(null)

  const viewTasks = visibleTasks(tasks, viewId)
  const viewName =
    viewId === ALL_VIEW_ID
      ? 'All'
      : viewId === TODAY_VIEW_ID
        ? 'Today'
        : lists.find((list) => list.id === viewId)?.name
  const selectedTask = viewTasks.find((task) => task.id === selectedTaskId)

  const selectView = (id: string) => {
    setViewId(id)
    setSelectedTaskId(null)
  }

  // Apply update to the subtasks of the task with id.
  const updateSubtasks = (
    taskId: string,
    update: (subtasks: Subtask[]) => Subtask[],
  ) =>
    setTasks((tasks) =>
      tasks.map((task) =>
        task.id === taskId ? { ...task, subtasks: update(task.subtasks) } : task,
      ),
    )

  const addTask = (text: string) =>
    setTasks((tasks) => [
      {
        id: crypto.randomUUID(),
        text,
        subtasks: [],
        stage: 'open',
        listId: viewId === ALL_VIEW_ID || viewId === TODAY_VIEW_ID ? undefined : viewId,
        addedToToday: viewId === TODAY_VIEW_ID ? true : undefined,
      },
      ...tasks,
    ])

  const addSubtask = (text: string) =>
    updateSubtasks(selectedTask!.id, (subtasks) => [
      { id: crypto.randomUUID(), text, done: false },
      ...subtasks,
    ])

  const deleteTask = (id: string) =>
    setTasks((tasks) => tasks.filter((task) => task.id !== id))

  const patchTask = (id: string, patch: Partial<Task>) =>
    setTasks((tasks) =>
      tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    )

  const isOpenTask = (task: Task) => task.stage !== 'done' && task.stage !== 'cancelled'

  // Set a task's stage, moving it after the last open task when it closes or reopens.
  const setStage = (id: string, stage: Stage) =>
    setTasks((tasks) => {
      const before = tasks.find((task) => task.id === id)!
      const patched = tasks.map((task) => (task.id === id ? { ...task, stage } : task))
      const after = patched.find((task) => task.id === id)!
      return isOpenTask(before) === isOpenTask(after)
        ? patched
        : moveAfterLastOpen(patched, id, isOpenTask)
    })

  const patchSubtask = (id: string, patch: Partial<Subtask>) =>
    updateSubtasks(selectedTaskId!, (subtasks) =>
      subtasks.map((subtask) =>
        subtask.id === id ? { ...subtask, ...patch } : subtask,
      ),
    )

  const toggleSubtask = (id: string) =>
    updateSubtasks(selectedTaskId!, (subtasks) =>
      moveAfterLastOpen(
        subtasks.map((subtask) =>
          subtask.id === id ? { ...subtask, done: !subtask.done } : subtask,
        ),
        id,
        (subtask) => !subtask.done,
      ),
    )

  const deleteSubtask = (id: string) =>
    updateSubtasks(selectedTaskId!, (subtasks) =>
      subtasks.filter((subtask) => subtask.id !== id),
    )

  const openMenu =
    (kind: ItemKind, id: string, text: string, due?: string) =>
    (event: React.MouseEvent) => {
      event.preventDefault()
      setMenu({ x: event.clientX, y: event.clientY, kind, id, text, due })
    }

  const renderRenameInput = (kind: ItemKind, id: string, className: string) =>
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
    if (kind === ItemKind.List) {
      setLists(
        lists.map((list) => (list.id === id ? { ...list, name } : list)),
      )
    } else if (kind === ItemKind.Task) {
      patchTask(id, { text: name })
    } else {
      patchSubtask(id, { text: name })
    }
  }

  const createList = (draft: string) => {
    const name = draft.trim()
    if (!name) return
    const newList = { id: crypto.randomUUID(), name }
    setLists([...lists, newList])
    selectView(newList.id)
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
      selectView(
        remaining.length > 0 ? (remaining[index - 1] ?? remaining[0]).id : ALL_VIEW_ID,
      )
    }
  }

  // Remember what is being dragged so DragOverlay can render a floating clone.
  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveDrag(active.data.current as { kind: ItemKind; text: string })
  }

  // Highlight the sidebar list row a task is hovering over.
  const onDragOver = ({ over }: DragOverEvent) => {
    const listIds = lists.map((list) => list.id)
    setDragOverViewId(
      over &&
        activeDrag?.kind === ItemKind.Task &&
        [...listIds, TODAY_VIEW_ID].includes(String(over.id))
        ? String(over.id)
        : null,
    )
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveDrag(null)
    setDragOverViewId(null)
    if (!over) return
    const overId = String(over.id)
    const nextState = applyDrop({ lists, tasks }, {
      viewId,
      selectedTaskId,
      dragKind: activeDrag?.kind,
      activeId: String(active.id),
      overId,
    })
    if (nextState.lists === lists && nextState.tasks === tasks) return
    setLists(nextState.lists)
    setTasks(nextState.tasks)
    if (
      activeDrag?.kind === ItemKind.Task &&
      (overId === TODAY_VIEW_ID || lists.some((list) => list.id === overId))
    )
      setSelectedTaskId(null)
  }

  return (
    <DndContext
      // hit-test by cursor: the wide dragged row would otherwise overlap main-area task rows instead of sidebar lists
      collisionDetection={pointerWithin}
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveDrag(null)
        setDragOverViewId(null)
      }}
    >
      <div className="flex h-screen overflow-hidden flex-col font-sans">
        <header className="flex h-12 shrink-0 items-center bg-gray-200 px-4">
          <span className="font-semibold text-gray-800">🍀 clover</span>
        </header>
        <div className="flex flex-1 min-h-0">
          <Sidebar
            lists={lists}
            tasks={tasks}
            viewId={viewId}
            dragOverViewId={dragOverViewId}
            onSelectView={selectView}
            onCreateList={createList}
            onContextMenu={openMenu}
            renderRenameInput={renderRenameInput}
          />
          <TaskView
            viewName={viewName}
            tasks={viewTasks}
            onAddTask={addTask}
            onSelectTask={setSelectedTaskId}
            onSetStage={setStage}
            onContextMenu={openMenu}
            renderRenameInput={renderRenameInput}
          />
          {selectedTask && (
            <DetailPanel
              task={selectedTask}
              onClose={() => setSelectedTaskId(null)}
              onAddSubtask={addSubtask}
              onToggleSubtask={toggleSubtask}
              onSetDue={(id, due) => patchTask(id, { due })}
              onSetPriority={(id, priority) => patchTask(id, { priority })}
              onContextMenu={openMenu}
              renderRenameInput={renderRenameInput}
            />
          )}
        </div>
      </div>
      <DragOverlay>
        {activeDrag && (
          <div className="cursor-default select-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-lg">
            {activeDrag.text}
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
            if (menu.kind === ItemKind.List) deleteList(menu.id)
            else if (menu.kind === ItemKind.Task) deleteTask(menu.id)
            else deleteSubtask(menu.id)
          }}
          onSetDue={(due) => patchTask(menu.id, { due })}
          onSetPriority={(priority) => patchTask(menu.id, { priority })}
        />
      )}
    </DndContext>
  )
}
