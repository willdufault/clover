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
import { isCompleted, moveAfterIncomplete } from './stages'
import { nextSelection } from './selection'
import { RowKind, type Stage, type Step, type Task } from './types'
import { ALL_LIST_ID, ALL_LIST_NAME, TODAY_LIST_ID, TODAY_LIST_NAME, tasksInList } from './smartLists'
import ContextMenu, { type ContextMenuState } from './components/ContextMenu'
import TaskDetailPane from './components/TaskDetailPane'
import ListSidebar from './components/ListSidebar'
import TaskPane from './components/TaskPane'
import { RenameInput } from './components/RenameInput'

export default function App() {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )
  const [lists, setLists] = useState(SEED_LISTS)
  const [tasks, setTasks] = useState(SEED_TASKS)
  const [selectedListId, setSelectedListId] = useState(SEED_LISTS[0].id)
  const [rawSelectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([])
  const [activeDrag, setActiveDrag] = useState<{ kind: RowKind; text: string } | null>(
    null,
  )
  const [dragOverListId, setDragOverListId] = useState<string | null>(null)
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [renaming, setRenaming] = useState<{
    kind: RowKind
    id: string
    draft: string
  } | null>(null)

  const listTasks = tasksInList(tasks, selectedListId)
  const currentList = lists.find((list) => list.id === selectedListId)
  let listName = currentList?.name
  if (selectedListId === ALL_LIST_ID) listName = ALL_LIST_NAME
  if (selectedListId === TODAY_LIST_ID) listName = TODAY_LIST_NAME
  // Ignore selected ids that left the current list.
  const selectedTaskIds = rawSelectedTaskIds.filter((id) => listTasks.some((task) => task.id === id))
  const detailTask =
    selectedTaskIds.length === 1
      ? listTasks.find((task) => task.id === selectedTaskIds[0])
      : undefined
  const detailTaskId = detailTask?.id ?? null

  // Replace the task selection; step selection belongs to the detail task, so it resets.
  const replaceTaskSelection = (ids: string[]) => {
    setSelectedTaskIds(ids)
    setSelectedStepIds([])
  }

  const selectList = (id: string) => {
    setSelectedListId(id)
    replaceTaskSelection([])
  }

  const clickModifiers = (event: React.MouseEvent) => ({
    ctrl: event.ctrlKey || event.metaKey,
    shift: event.shiftKey,
  })

  const selectTask = (id: string, event: React.MouseEvent) =>
    replaceTaskSelection(
      nextSelection(selectedTaskIds, listTasks.map((task) => task.id), id, clickModifiers(event)),
    )

  const selectStep = (id: string, event: React.MouseEvent) =>
    setSelectedStepIds(
      nextSelection(
        selectedStepIds,
        detailTask!.steps.map((step) => step.id),
        id,
        clickModifiers(event),
      ),
    )

  // Escape clears all selection, unless a menu handled it or it came from a text field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key === 'Escape' && !event.defaultPrevented && !target.closest('input, textarea, select'))
        replaceTaskSelection([])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  // Apply update to the steps of the detail task.
  const updateDetailSteps = (update: (steps: Step[]) => Step[]) =>
    setTasks((tasks) =>
      tasks.map((task) =>
        task.id === detailTaskId ? { ...task, steps: update(task.steps) } : task,
      ),
    )

  const addTask = (text: string) =>
    setTasks((tasks) => [
      {
        id: crypto.randomUUID(),
        text,
        steps: [],
        stage: 'open',
        listId: currentList?.id,
        addedToToday: selectedListId === TODAY_LIST_ID ? true : undefined,
      },
      ...tasks,
    ])

  const addStep = (text: string) => {
    updateDetailSteps((steps) => [
      ...steps,
      { id: crypto.randomUUID(), text, completed: false },
    ])
  }

  const deleteTasks = (ids: string[]) => {
    setTasks((tasks) => tasks.filter((task) => !ids.includes(task.id)))
    replaceTaskSelection([])
  }

  const updateTask = (id: string, patch: Partial<Task>) =>
    setTasks((tasks) =>
      tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    )

  // Set a task's stage, moving it after the last incomplete task when it completes or reopens.
  const setTaskStage = (id: string, stage: Stage) =>
    setTasks((tasks) => {
      const before = tasks.find((task) => task.id === id)!
      const patched = tasks.map((task) => (task.id === id ? { ...task, stage } : task))
      return isCompleted(before.stage) === isCompleted(stage)
        ? patched
        : moveAfterIncomplete(patched, id, (task) => isCompleted(task.stage))
    })

  const updateStep = (id: string, patch: Partial<Step>) =>
    updateDetailSteps((steps) =>
      steps.map((step) =>
        step.id === id ? { ...step, ...patch } : step,
      ),
    )

  const toggleStep = (id: string) =>
    updateDetailSteps((steps) =>
      moveAfterIncomplete(
        steps.map((step) =>
          step.id === id ? { ...step, completed: !step.completed } : step,
        ),
        id,
        (step) => step.completed,
      ),
    )

  const deleteSteps = (ids: string[]) => {
    updateDetailSteps((steps) =>
      steps.filter((step) => !ids.includes(step.id)),
    )
    setSelectedStepIds([])
  }

  const openContextMenu =
    (kind: RowKind, id: string) =>
    (event: React.MouseEvent) => {
      event.preventDefault()
      setRenaming(null)
      const selected = kind === RowKind.Task ? selectedTaskIds : selectedStepIds
      let ids = [id]
      if (kind !== RowKind.List && selected.includes(id)) ids = selected
      else if (kind === RowKind.Task) replaceTaskSelection(ids)
      else if (kind === RowKind.Step) setSelectedStepIds(ids)
      const dueTask = tasks.find((task) => ids.includes(task.id) && task.due)
      setMenu({
        x: event.clientX,
        y: event.clientY,
        kind,
        ids,
        due: dueTask?.due,
      })
    }

  const startRename = (kind: RowKind, id: string, draft: string) =>
    setRenaming({ kind, id, draft })

  const renderRenameInput = (kind: RowKind, id: string, className: string) =>
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
    if (kind === RowKind.List) {
      setLists(
        lists.map((list) => (list.id === id ? { ...list, name } : list)),
      )
    } else if (kind === RowKind.Task) {
      updateTask(id, { text: name })
    } else {
      updateStep(id, { text: name })
    }
  }

  const createList = (name: string) => {
    const newList = { id: crypto.randomUUID(), name }
    setLists([...lists, newList])
    selectList(newList.id)
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
    if (id === selectedListId) {
      selectList(
        remaining.length > 0 ? (remaining[index - 1] ?? remaining[0]).id : ALL_LIST_ID,
      )
    }
  }

  // Remember what is being dragged so DragOverlay can render a floating clone.
  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveDrag(active.data.current as { kind: RowKind; text: string })
  }

  // Highlight the sidebar list row a task is hovering over.
  const handleDragOver = ({ over }: DragOverEvent) => {
    const listIds = lists.map((list) => list.id)
    setDragOverListId(
      over &&
        activeDrag?.kind === RowKind.Task &&
        [...listIds, TODAY_LIST_ID].includes(String(over.id))
        ? String(over.id)
        : null,
    )
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveDrag(null)
    setDragOverListId(null)
    if (!over) return
    const overId = String(over.id)
    const nextState = applyDrop({ lists, tasks }, {
      selectedListId,
      detailTaskId,
      dragKind: activeDrag?.kind,
      activeId: String(active.id),
      overId,
    })
    if (nextState.lists === lists && nextState.tasks === tasks) return
    setLists(nextState.lists)
    setTasks(nextState.tasks)
    if (
      activeDrag?.kind === RowKind.Task &&
      (overId === TODAY_LIST_ID || lists.some((list) => list.id === overId))
    )
      replaceTaskSelection([])
  }

  return (
    <DndContext
      // hit-test by cursor: the wide dragged row would otherwise overlap main-area task rows instead of sidebar lists
      collisionDetection={pointerWithin}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveDrag(null)
        setDragOverListId(null)
      }}
    >
      <div className="flex h-screen overflow-hidden flex-col font-sans">
        <header className="flex h-12 shrink-0 items-center bg-gray-200 px-4">
          <span className="font-semibold text-gray-800">🍀 clover</span>
        </header>
        <div className="flex flex-1 min-h-0">
          <ListSidebar
            lists={lists}
            tasks={tasks}
            selectedListId={selectedListId}
            dragOverListId={dragOverListId}
            onSelectList={selectList}
            onCreateList={createList}
            onContextMenu={openContextMenu}
          />
          <TaskPane
            selectedListId={selectedListId}
            listName={listName}
            renamable={!!currentList}
            onRename={startRename}
            tasks={listTasks}
            onAddTask={addTask}
            selectedIds={selectedTaskIds}
            onSelectTask={selectTask}
            onSetStage={setTaskStage}
            onContextMenu={openContextMenu}
            renderRenameInput={renderRenameInput}
          />
          {detailTask && (
            <TaskDetailPane
              task={detailTask}
              selectedIds={selectedStepIds}
              onSelectStep={selectStep}
              onClose={() => replaceTaskSelection([])}
              onDeleteTask={() => deleteTasks([detailTask.id])}
              onAddStep={addStep}
              onToggleStep={toggleStep}
              onDeleteStep={(id) => deleteSteps([id])}
              onSetDue={(id, due) => updateTask(id, { due })}
              onSetPriority={(id, priority) => updateTask(id, { priority })}
              onSetStage={setTaskStage}
              onContextMenu={openContextMenu}
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
            if (menu.kind === RowKind.List) deleteList(menu.ids[0])
            else if (menu.kind === RowKind.Task) deleteTasks(menu.ids)
            else deleteSteps(menu.ids)
          }}
          onSetDue={(due) => menu.ids.forEach((id) => updateTask(id, { due }))}
          onSetPriority={(priority) =>
            menu.ids.forEach((id) => updateTask(id, { priority }))
          }
          onSetStage={(stage) => menu.ids.forEach((id) => setTaskStage(id, stage))}
          onSetStepCompleted={(completed) =>
            detailTask!.steps
              .filter((step) => menu.ids.includes(step.id) && step.completed !== completed)
              .forEach((step) => toggleStep(step.id))
          }
        />
      )}
    </DndContext>
  )
}
