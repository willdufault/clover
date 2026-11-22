import { useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from '@dnd-kit/core'
import { api } from './api'
import { applyDrop } from './drop'
import { nextSelection } from './selection'
import { applySort, type SortCriteria } from './sort'
import { RowKind, type Step, type Task, type TaskList, type TaskPatch } from './types'
import { ALL_LIST_ID, SMART_LIST_NAMES, TODAY_LIST_ID, tasksInList } from './smartLists'
import ContextMenu, { type ContextMenuState, type OpenContextMenu } from './components/ContextMenu'
import TaskDetailPane from './components/TaskDetailPane'
import ListSidebar from './components/ListSidebar'
import TaskPane from './components/TaskPane'
import { SAFE_AREA_CLASS } from './styles'
import { useOverlays } from './useOverlays'

type DragInfo = { kind: RowKind; text: string }

const clickModifiers = (event: React.MouseEvent) => ({
  ctrl: event.ctrlKey || event.metaKey,
  shift: event.shiftKey,
})

const soleTask = (tasks: Task[], ids: string[]) =>
  ids.length === 1 ? tasks.find((task) => task.id === ids[0]) : undefined

export default function App() {
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }))
  const [lists, setLists] = useState<TaskList[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedListId, setSelectedListId] = useState(ALL_LIST_ID)
  const [rawSelectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([])
  const [activeDrag, setActiveDrag] = useState<DragInfo | null>(null)
  const [dragOverListId, setDragOverListId] = useState<string | null>(null)
  const [menu, setMenu] = useState<ContextMenuState | null>(null)

  const listTasks = tasksInList(tasks, selectedListId)
  const currentList = lists.find((list) => list.id === selectedListId)
  const listName = SMART_LIST_NAMES[selectedListId] ?? currentList?.name
  const selectedTaskIds = rawSelectedTaskIds.filter((id) => listTasks.some((task) => task.id === id))
  const detailTask = soleTask(listTasks, selectedTaskIds)
  const detailSteps = detailTask?.steps ?? []
  const { drawerOpen, setDrawerOpen, detailModal, mainInert } = useOverlays(!!detailTask)

  const replaceTaskSelection = (ids: string[]) => {
    setSelectedTaskIds(ids)
    setSelectedStepIds([])
  }

  const selectList = (id: string) => {
    setSelectedListId(id)
    replaceTaskSelection([])
    setDrawerOpen(false)
  }

  const selectTask = (id: string, event: React.MouseEvent) =>
    replaceTaskSelection(
      nextSelection(
        selectedTaskIds,
        listTasks.map((task) => task.id),
        id,
        clickModifiers(event),
      ),
    )

  const selectStep = (id: string, event: React.MouseEvent) =>
    setSelectedStepIds(
      nextSelection(
        selectedStepIds,
        detailSteps.map((step) => step.id),
        id,
        clickModifiers(event),
      ),
    )

  const run = (action: () => Promise<void>) => {
    action().catch((e) => setError((e as Error).message))
  }

  useEffect(() => {
    api('GET', '/data')
      .then((data: { lists: TaskList[]; tasks: Omit<Task, 'steps'>[]; steps: Step[] }) => {
        setLists(data.lists)
        setTasks(data.tasks.map((task) => ({ ...task, steps: data.steps.filter((step) => step.taskId === task.id) })))
        setSelectedListId(data.lists[0]?.id ?? ALL_LIST_ID)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if ((event.target as HTMLElement).closest('input, textarea, select')) return
      if (drawerOpen) return setDrawerOpen(false)
      setSelectedTaskIds([])
      setSelectedStepIds([])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [drawerOpen, setDrawerOpen])

  // PATCH and DELETE take a batch and save all or nothing, so each action is one request.
  const patchTasks = async (patches: Partial<Task>[]) => {
    const updated: Omit<Task, 'steps'>[] = await api('PATCH', '/tasks', patches)
    setTasks((prev) => prev.map((task) => ({ ...task, ...updated.find((other) => other.id === task.id) })))
  }

  const patchSteps = async (patches: Partial<Step>[]) => {
    const updated: Step[] = await api('PATCH', '/steps', patches)
    setTasks((prev) =>
      prev.map((task) => ({
        ...task,
        steps: task.steps.map((step) => updated.find((other) => other.id === step.id) ?? step),
      })),
    )
  }

  const addTask = (title: string) =>
    run(async () => {
      const task = await api('POST', '/tasks', {
        title,
        listId: currentList?.id ?? null,
        addedToToday: selectedListId === TODAY_LIST_ID,
      })
      setTasks((prev) => [...prev, { ...task, steps: [] }])
    })

  const addStep = (title: string) =>
    run(async () => {
      const step: Step = await api('POST', '/steps', { taskId: detailTask?.id, title })
      setTasks((prev) =>
        prev.map((task) => (task.id === step.taskId ? { ...task, steps: [...task.steps, step] } : task)),
      )
    })

  const deleteTasks = (ids: string[]) =>
    run(async () => {
      await api('DELETE', '/tasks', { ids })
      setTasks((prev) => prev.filter((task) => !ids.includes(task.id)))
      replaceTaskSelection([])
    })

  const updateTasks = (ids: string[], patch: TaskPatch) => run(() => patchTasks(ids.map((id) => ({ id, ...patch }))))

  const updateTask = (id: string, patch: TaskPatch) => updateTasks([id], patch)

  const sortList = (criteria: SortCriteria) => setTasks((prev) => applySort(prev, listTasks, criteria))

  const setStepsCompleted = (ids: string[], completed: boolean) =>
    run(async () => {
      if (ids.length) await patchSteps(ids.map((id) => ({ id, completed })))
    })

  const deleteSteps = (ids: string[]) =>
    run(async () => {
      await api('DELETE', '/steps', { ids })
      setTasks((prev) => prev.map((task) => ({ ...task, steps: task.steps.filter((step) => !ids.includes(step.id)) })))
      setSelectedStepIds([])
    })

  // A touch long-press passes the row title and leaves the selection alone.
  const openContextMenu: OpenContextMenu = (kind, id) => (event, longPressTitle) => {
    event.preventDefault()
    if (activeDrag) return
    const select = longPressTitle === undefined
    const selected = kind === RowKind.Task ? selectedTaskIds : selectedStepIds
    let ids = [id]
    if (kind !== RowKind.List && selected.includes(id)) ids = selected
    else if (select && kind === RowKind.Task) replaceTaskSelection(ids)
    else if (select && kind === RowKind.Step) setSelectedStepIds(ids)
    const menuTasks = tasks.filter((task) => ids.includes(task.id))
    const allDone = detailTask?.steps.filter((step) => ids.includes(step.id)).every((step) => step.completed)
    setMenu({
      x: event.clientX,
      y: event.clientY,
      kind,
      ids,
      title: longPressTitle,
      moveTargets: lists.filter((list) => !menuTasks.every((task) => task.listId === list.id)),
      hasDue: menuTasks.some((task) => task.due),
      allInToday: menuTasks.every((task) => task.addedToToday),
      allDone,
    })
  }

  const renameList = (id: string, name: string) =>
    run(async () => {
      const [updated]: TaskList[] = await api('PATCH', '/lists', [{ id, name }])
      if (!updated) throw new Error('List rename returned no list')
      setLists((prev) => prev.map((list) => (list.id === id ? updated : list)))
    })

  const renameStep = (id: string, title: string) => run(() => patchSteps([{ id, title }]))

  const createList = (name: string) =>
    run(async () => {
      const newList: TaskList = await api('POST', '/lists', { name })
      setLists((prev) => [...prev, newList])
      selectList(newList.id)
    })

  // The server also deletes the list's tasks and their steps.
  const deleteList = (id: string) =>
    run(async () => {
      const remaining = lists.filter((list) => list.id !== id)
      const index = lists.findIndex((list) => list.id === id)
      const neighborId = (remaining[index - 1] ?? remaining[0])?.id ?? ALL_LIST_ID
      await api('DELETE', '/lists', { ids: [id] })
      setLists((prev) => prev.filter((list) => list.id !== id))
      setTasks((prev) => prev.filter((task) => task.listId !== id))
      // The deleted list's tasks and steps are gone, so stale task/step selection is harmless.
      setSelectedListId((current) => (current === id ? neighborId : current))
    })

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveDrag(active.data.current as DragInfo)
  }

  const taskDropTarget = (over: Over | null) => {
    if (!over || activeDrag?.kind !== RowKind.Task) return null
    const id = String(over.id)
    return id === TODAY_LIST_ID || lists.some((list) => list.id === id) ? id : null
  }

  const handleDragOver = ({ over }: DragOverEvent) => {
    setDragOverListId(taskDropTarget(over))
  }

  const endDrag = () => {
    setActiveDrag(null)
    setDragOverListId(null)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    endDrag()
    if (!over) return
    const overId = String(over.id)
    const target = taskDropTarget(over)
    if (target) {
      setDrawerOpen(false)
      replaceTaskSelection([])
      if (target === TODAY_LIST_ID) return updateTask(String(active.id), { addedToToday: true })
      const dragged = tasks.find((task) => task.id === active.id)
      if (dragged?.listId === target) return
      updateTask(String(active.id), { listId: target })
      return
    }
    const nextState = applyDrop(
      { lists, tasks },
      {
        selectedListId,
        detailTaskId: detailTask?.id ?? null,
        activeId: String(active.id),
        overId,
      },
    )
    setLists(nextState.lists)
    setTasks(nextState.tasks)
  }

  if (loading) return <p className="p-8 text-ink-soft">Loading…</p>

  return (
    <DndContext
      // Cursor hit-test; the wide dragged row would otherwise overlap task rows instead of sidebar lists.
      collisionDetection={pointerWithin}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={endDrag}
    >
      <div className={'flex h-dvh overflow-hidden flex-col font-sans ' + SAFE_AREA_CLASS}>
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 bg-coral-50 px-4 py-2 text-sm text-coral"
          >
            <span className="min-w-0 break-words">{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss error" className="shrink-0">
              ×
            </button>
          </div>
        )}
        <div className="flex flex-1 min-h-0">
          <ListSidebar
            lists={lists}
            tasks={tasks}
            selectedListId={selectedListId}
            dragOverListId={dragOverListId}
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            onSelectList={selectList}
            onCreateList={createList}
            onContextMenu={openContextMenu}
            inert={detailModal}
          />
          <TaskPane
            selectedListId={selectedListId}
            listName={listName}
            renamable={!!currentList}
            onRenameList={renameList}
            tasks={listTasks}
            onAddTask={addTask}
            onSort={sortList}
            selectedIds={selectedTaskIds}
            onSelectTask={selectTask}
            onClearSelection={() => replaceTaskSelection([])}
            onSetStage={(id, stage) => updateTask(id, { stage })}
            onContextMenu={openContextMenu}
            onOpenLists={() => setDrawerOpen(true)}
            inert={mainInert}
          />
          {detailTask && (
            <>
              <div
                onClick={() => replaceTaskSelection([])}
                className="fixed inset-0 z-30 hidden bg-ink/20 lg:block xl:hidden"
              />
              <TaskDetailPane
                task={detailTask}
                selectedIds={selectedStepIds}
                onSelectStep={selectStep}
                onClose={() => replaceTaskSelection([])}
                onDeleteTask={() => deleteTasks([detailTask.id])}
                onAddStep={addStep}
                onToggleStep={(id, completed) => setStepsCompleted([id], completed)}
                onDeleteStep={(id) => deleteSteps([id])}
                onUpdate={(patch) => updateTask(detailTask.id, patch)}
                onContextMenu={openContextMenu}
                onRenameStep={renameStep}
                modal={detailModal}
              />
            </>
          )}
        </div>
      </div>
      <DragOverlay>
        {activeDrag && (
          <div className="cursor-default select-none rounded-xl border border-clover-200 bg-paper px-3.5 py-2 text-sm text-ink shadow-pop">
            {activeDrag.text}
          </div>
        )}
      </DragOverlay>

      {menu && (
        <ContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onDelete={() => {
            if (menu.kind === RowKind.List) {
              const [listId] = menu.ids
              if (listId) deleteList(listId)
            } else if (menu.kind === RowKind.Task) deleteTasks(menu.ids)
            else deleteSteps(menu.ids)
          }}
          onUpdate={(patch) => updateTasks(menu.ids, patch)}
          onSetStepCompleted={(completed) =>
            setStepsCompleted(
              detailSteps
                .filter((step) => menu.ids.includes(step.id) && step.completed !== completed)
                .map((step) => step.id),
              completed,
            )
          }
        />
      )}
    </DndContext>
  )
}
