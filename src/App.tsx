import { useEffect, useState } from 'react'
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
import { nextSelection } from './selection'
import { ItemKind, type Stage, type Step, type Task } from './types'
import { ALL_VIEW_ID, ALL_VIEW_NAME, TODAY_VIEW_ID, TODAY_VIEW_NAME, visibleTasks } from './views'
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
  const [rawSelectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([])
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
  let viewName: string | undefined
  if (viewId === ALL_VIEW_ID) viewName = ALL_VIEW_NAME
  else if (viewId === TODAY_VIEW_ID) viewName = TODAY_VIEW_NAME
  else viewName = lists.find((list) => list.id === viewId)?.name
  // Ignore selected ids that left the current view.
  const selectedTaskIds = rawSelectedTaskIds.filter((id) => viewTasks.some((task) => task.id === id))
  const selectedTask =
    selectedTaskIds.length === 1
      ? viewTasks.find((task) => task.id === selectedTaskIds[0])
      : undefined
  const selectedTaskId = selectedTask?.id ?? null

  // Replace the task selection; step selection belongs to the open task, so it resets.
  const selectTasks = (ids: string[]) => {
    setSelectedTaskIds(ids)
    setSelectedStepIds([])
  }

  const selectView = (id: string) => {
    setViewId(id)
    selectTasks([])
  }

  const modifiers = (event: React.MouseEvent) => ({
    ctrl: event.ctrlKey || event.metaKey,
    shift: event.shiftKey,
  })

  const selectTask = (id: string, event: React.MouseEvent) =>
    selectTasks(
      nextSelection(selectedTaskIds, viewTasks.map((task) => task.id), id, modifiers(event)),
    )

  const selectStep = (id: string, event: React.MouseEvent) =>
    setSelectedStepIds(
      nextSelection(
        selectedStepIds,
        selectedTask!.steps.map((step) => step.id),
        id,
        modifiers(event),
      ),
    )

  // Escape clears all selection, unless a menu handled it or it came from a text field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key === 'Escape' && !event.defaultPrevented && !target.closest('input, textarea, select'))
        selectTasks([])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  // Apply update to the steps of the task with id.
  const updateSteps = (
    taskId: string,
    update: (steps: Step[]) => Step[],
  ) =>
    setTasks((tasks) =>
      tasks.map((task) =>
        task.id === taskId ? { ...task, steps: update(task.steps) } : task,
      ),
    )

  const addTask = (text: string) =>
    setTasks((tasks) => [
      {
        id: crypto.randomUUID(),
        text,
        steps: [],
        stage: 'open',
        listId: viewId === ALL_VIEW_ID || viewId === TODAY_VIEW_ID ? undefined : viewId,
        addedToToday: viewId === TODAY_VIEW_ID ? true : undefined,
      },
      ...tasks,
    ])

  const addStep = (text: string) => {
    updateSteps(selectedTask!.id, (steps) => [
      ...steps,
      { id: crypto.randomUUID(), text, done: false },
    ])
  }

  const deleteTasks = (ids: string[]) => {
    setTasks((tasks) => tasks.filter((task) => !ids.includes(task.id)))
    selectTasks([])
  }

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

  const patchStep = (id: string, patch: Partial<Step>) =>
    updateSteps(selectedTaskId!, (steps) =>
      steps.map((step) =>
        step.id === id ? { ...step, ...patch } : step,
      ),
    )

  const toggleStep = (id: string) =>
    updateSteps(selectedTaskId!, (steps) =>
      moveAfterLastOpen(
        steps.map((step) =>
          step.id === id ? { ...step, done: !step.done } : step,
        ),
        id,
        (step) => !step.done,
      ),
    )

  const deleteSteps = (ids: string[]) => {
    updateSteps(selectedTaskId!, (steps) =>
      steps.filter((step) => !ids.includes(step.id)),
    )
    setSelectedStepIds([])
  }

  const openMenu =
    (kind: ItemKind, id: string) =>
    (event: React.MouseEvent) => {
      event.preventDefault()
      setRenaming(null)
      const selected = kind === ItemKind.Task ? selectedTaskIds : selectedStepIds
      let ids = [id]
      if (kind !== ItemKind.List && selected.includes(id)) ids = selected
      else if (kind === ItemKind.Task) selectTasks(ids)
      else if (kind === ItemKind.Step) setSelectedStepIds(ids)
      const dueTask = tasks.find((task) => ids.includes(task.id) && task.due)
      setMenu({
        x: event.clientX,
        y: event.clientY,
        kind,
        ids,
        due: dueTask?.due,
      })
    }

  const startRename = (kind: ItemKind, id: string, draft: string) =>
    setRenaming({ kind, id, draft })

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
      patchStep(id, { text: name })
    }
  }

  const createList = (name: string) => {
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
      selectTasks([])
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
          />
          <TaskView
            viewId={viewId}
            viewName={viewName}
            renamable={viewId !== ALL_VIEW_ID && viewId !== TODAY_VIEW_ID}
            onRename={startRename}
            tasks={viewTasks}
            onAddTask={addTask}
            selectedIds={selectedTaskIds}
            onSelectTask={selectTask}
            onSetStage={setStage}
            onContextMenu={openMenu}
            renderRenameInput={renderRenameInput}
          />
          {selectedTask && (
            <DetailPanel
              task={selectedTask}
              selectedIds={selectedStepIds}
              onSelectStep={selectStep}
              onClose={() => selectTasks([])}
              onDeleteTask={() => deleteTasks([selectedTask.id])}
              onAddStep={addStep}
              onToggleStep={toggleStep}
              onDeleteStep={(id) => deleteSteps([id])}
              onSetDue={(id, due) => patchTask(id, { due })}
              onSetPriority={(id, priority) => patchTask(id, { priority })}
              onSetStage={setStage}
              onContextMenu={openMenu}
              onRename={startRename}
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
          onDelete={() => {
            if (menu.kind === ItemKind.List) deleteList(menu.ids[0])
            else if (menu.kind === ItemKind.Task) deleteTasks(menu.ids)
            else deleteSteps(menu.ids)
          }}
          onSetDue={(due) => menu.ids.forEach((id) => patchTask(id, { due }))}
          onSetPriority={(priority) =>
            menu.ids.forEach((id) => patchTask(id, { priority }))
          }
          onSetStage={(stage) => menu.ids.forEach((id) => setStage(id, stage))}
          onSetStepDone={(done) =>
            selectedTask!.steps
              .filter((step) => menu.ids.includes(step.id) && step.done !== done)
              .forEach((step) => toggleStep(step.id))
          }
        />
      )}
    </DndContext>
  )
}
