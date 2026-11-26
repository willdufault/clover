import { useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  getClientRect,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Over,
} from '@dnd-kit/core'
import { api } from './api'
import { applyDrop, idsToMove } from './drop'
import { nextSelection } from './selection'
import { sortTasks, type SortCriteria } from './sort'
import { RowKind, type Step, type Task, type TaskList, type TaskPatch } from './types'
import { ALL_LIST_ID, SMART_LIST_NAMES, neighborListId, TODAY_LIST_ID, tasksInList } from './smartLists'
import ContextMenu, { type ContextMenuState, type OpenContextMenu } from './components/ContextMenu'
import TaskDetailPane from './components/TaskDetailPane'
import ListSidebar from './components/ListSidebar'
import TaskPane from './components/TaskPane'
import { ICON_BUTTON_CLASS, SAFE_AREA_CLASS } from './styles'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { useOverlays } from './useOverlays'

type DragInfo = { kind: RowKind; clone: React.ReactNode }

const lastRects = new WeakMap<HTMLElement, ReturnType<typeof getClientRect>>()
const measureDraggable = (node: HTMLElement) => {
  if (node.offsetParent) lastRects.set(node, getClientRect(node))
  return lastRects.get(node) ?? getClientRect(node)
}

const clickModifiers = (event: React.MouseEvent) => ({
  ctrl: event.ctrlKey || event.metaKey,
  shift: event.shiftKey,
})

const soleTask = (tasks: Task[], ids: string[]) =>
  ids.length === 1 ? tasks.find((task) => task.id === ids[0]) : undefined

const shared = <T,>(values: T[]) => (values.every((value) => value === values[0]) ? values[0] : undefined)

const DragStack = ({ stacked, children }: { stacked: boolean; children: React.ReactNode }) => (
  <div className="relative h-full">
    {stacked && <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-lg bg-parchment shadow-md" />}
    <div className="relative h-full">{children}</div>
  </div>
)

export default function App() {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 10 } }),
  )
  const [lists, setLists] = useState<TaskList[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedListId, setSelectedListId] = useState(ALL_LIST_ID)
  const [rawSelectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [sort, setSort] = useState<SortCriteria | null>(null)
  const [activeDrag, setActiveDrag] = useState<(DragInfo & { touch: boolean }) | null>(null)
  const [dragIds, setDragIds] = useState<string[]>([])
  const [dragOverListId, setDragOverListId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const visibleTasks = sortTasks(tasksInList(tasks, selectedListId), sort)
  const selectedList = lists.find((list) => list.id === selectedListId)
  const listName = SMART_LIST_NAMES[selectedListId] ?? selectedList?.name
  const selectedTaskIds = rawSelectedTaskIds.filter((id) => visibleTasks.some((task) => task.id === id))
  const detailTask = soleTask(visibleTasks, selectedTaskIds)
  const { drawerOpen, setDrawerOpen, detailModal, mainInert } = useOverlays(!!detailTask)

  const selectList = (id: string) => {
    setSelectedListId(id)
    setSort(null)
    setSelectedTaskIds([])
    setDrawerOpen(false)
  }

  const selectTask = (id: string, event: React.MouseEvent) =>
    setSelectedTaskIds(
      nextSelection(
        selectedTaskIds,
        visibleTasks.map((task) => task.id),
        id,
        clickModifiers(event),
      ),
    )

  const runReportingErrors = (action: () => Promise<void>) => {
    action().catch((e) => setError((e as Error).message))
  }

  useEffect(() => {
    api<{ lists: TaskList[]; tasks: Omit<Task, 'steps'>[]; steps: Step[] }>('GET', '/data')
      .then((data) => {
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
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen, setDrawerOpen])

  const updateSteps = async (patches: Partial<Step>[]) => {
    const updated = await api<Step[]>('PATCH', '/steps', patches)
    setTasks((prev) =>
      prev.map((task) => ({
        ...task,
        steps: task.steps.map((step) => updated.find((other) => other.id === step.id) ?? step),
      })),
    )
  }

  const addTask = (title: string) =>
    runReportingErrors(async () => {
      const task = await api<Omit<Task, 'steps'>>('POST', '/tasks', {
        title,
        listId: selectedList?.id ?? null,
        addedToToday: selectedListId === TODAY_LIST_ID,
      })
      setTasks((prev) => [...prev, { ...task, steps: [] }])
    })

  const addStep = (title: string) =>
    runReportingErrors(async () => {
      const step = await api<Step>('POST', '/steps', { taskId: detailTask?.id, title })
      setTasks((prev) =>
        prev.map((task) => (task.id === step.taskId ? { ...task, steps: [...task.steps, step] } : task)),
      )
    })

  const deleteTasks = (ids: string[]) =>
    runReportingErrors(async () => {
      await api('DELETE', '/tasks', { ids })
      setTasks((prev) => prev.filter((task) => !ids.includes(task.id)))
      setSelectedTaskIds([])
    })

  const updateTasks = (ids: string[], patch: TaskPatch) =>
    runReportingErrors(async () => {
      const updated = await api<Omit<Task, 'steps'>[]>(
        'PATCH',
        '/tasks',
        ids.map((id) => ({ id, ...patch })),
      )
      setTasks((prev) => prev.map((task) => ({ ...task, ...updated.find((other) => other.id === task.id) })))
    })

  const updateTask = (id: string, patch: TaskPatch) => updateTasks([id], patch)

  const toggleDone = ({ id, stage }: Task) => updateTask(id, { stage: stage === 'done' ? 'open' : 'done' })

  const setStepCompleted = (id: string, completed: boolean) =>
    runReportingErrors(() => updateSteps([{ id, completed }]))

  const deleteSteps = (ids: string[]) =>
    runReportingErrors(async () => {
      await api('DELETE', '/steps', { ids })
      setTasks((prev) => prev.map((task) => ({ ...task, steps: task.steps.filter((step) => !ids.includes(step.id)) })))
    })

  const actionIds = (kind: RowKind, id: string) =>
    kind === RowKind.Task && selectedTaskIds.includes(id) ? selectedTaskIds : [id]

  const openContextMenu: OpenContextMenu = (kind, id) => (event) => {
    const ids = actionIds(kind, id)
    const menuTasks = tasks.filter((task) => ids.includes(task.id))
    const name = kind === RowKind.Task ? menuTasks[0]?.title : lists.find((list) => list.id === id)?.name
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      above: event.above,
      kind,
      ids,
      title: ids.length > 1 ? `${ids.length} tasks` : name,
      moveTargets: lists.filter((list) => !menuTasks.every((task) => task.listId === list.id)),
      anyHasDue: menuTasks.some((task) => task.due),
      allInToday: menuTasks.every((task) => task.addedToToday),
      stage: shared(menuTasks.map((task) => task.stage)),
      priority: shared(menuTasks.map((task) => task.priority)),
      due: shared(menuTasks.map((task) => task.due)),
    })
  }

  const deleteMenuTargets = ({ kind, ids }: ContextMenuState) => {
    if (kind === RowKind.List) deleteLists(ids)
    else deleteTasks(ids)
  }

  const menuIds = contextMenu?.ids ?? []

  const renameList = (id: string, name: string) =>
    runReportingErrors(async () => {
      const [updated] = await api<[TaskList]>('PATCH', '/lists', [{ id, name }])
      setLists((prev) => prev.map((list) => (list.id === id ? updated : list)))
    })

  const renameStep = (id: string, title: string) => runReportingErrors(() => updateSteps([{ id, title }]))

  const createList = (name: string) =>
    runReportingErrors(async () => {
      const newList = await api<TaskList>('POST', '/lists', { name })
      setLists((prev) => [...prev, newList])
      selectList(newList.id)
    })

  const deleteLists = (ids: string[]) =>
    runReportingErrors(async () => {
      const neighborId = neighborListId(lists, ids)
      await api('DELETE', '/lists', { ids })
      setLists((prev) => prev.filter((list) => !ids.includes(list.id)))
      setTasks((prev) => prev.filter((task) => !task.listId || !ids.includes(task.listId)))
      setSelectedListId((current) => (ids.includes(current) ? neighborId : current))
    })

  const taskDropListId = (over: Over | null) => {
    if (!over || activeDrag?.kind !== RowKind.Task || activeDrag.touch) return null
    const id = String(over.id)
    return id === TODAY_LIST_ID || lists.some((list) => list.id === id) ? id : null
  }

  const resetDragState = () => {
    setActiveDrag(null)
    setDragIds([])
    setDragOverListId(null)
  }

  const handleDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    const drag = active.data.current as DragInfo
    const touch = activatorEvent.type === 'touchstart'
    setActiveDrag({ ...drag, touch })
    setDragIds(touch ? [String(active.id)] : actionIds(drag.kind, String(active.id)))
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    resetDragState()
    if (!over) return
    const targetListId = taskDropListId(over)
    if (targetListId) {
      setSelectedTaskIds([])
      const ids = idsToMove(tasks, dragIds, targetListId)
      if (ids.length > 0)
        updateTasks(ids, targetListId === TODAY_LIST_ID ? { addedToToday: true } : { listId: targetListId })
      return
    }
    const nextState = applyDrop(
      { lists, tasks },
      {
        selectedListId,
        detailTask,
        activeId: String(active.id),
        overId: String(over.id),
      },
    )
    setLists(nextState.lists)
    setTasks(nextState.tasks)
  }

  if (loading) return <p className="p-8 font-sans text-moss/80">Loading…</p>

  return (
    <DndContext
      collisionDetection={pointerWithin}
      measuring={{ draggable: { measure: measureDraggable } }}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={({ over }) => setDragOverListId(taskDropListId(over))}
      onDragEnd={handleDragEnd}
      onDragCancel={resetDragState}
    >
      <div className={'flex h-dvh overflow-hidden flex-col font-sans ' + SAFE_AREA_CLASS}>
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 bg-rosehip/10 px-4 py-2 text-base text-moss"
          >
            <span className="min-w-0 break-words">{error}</span>
            <button
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              className={ICON_BUTTON_CLASS + ' text-rosehip'}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        )}
        <div className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-1 2xl:border-x 2xl:border-fieldstone">
          <ListSidebar
            lists={lists}
            tasks={tasks}
            selectedListId={selectedListId}
            dragOverListId={dragOverListId}
            menuIds={menuIds}
            drawerOpen={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            onSelectList={selectList}
            onCreateList={createList}
            onContextMenu={openContextMenu}
            inert={detailModal}
          />
          <TaskPane
            selectedListId={selectedListId}
            listName={listName}
            renamable={!!selectedList}
            onRenameList={renameList}
            onDeleteList={(id) => deleteLists([id])}
            tasks={visibleTasks}
            onAddTask={addTask}
            onSort={setSort}
            sort={sort}
            selectedIds={selectedTaskIds}
            menuIds={menuIds}
            dragIds={dragIds}
            onSelectTask={selectTask}
            onClearSelection={() => setSelectedTaskIds([])}
            onToggleDone={toggleDone}
            onContextMenu={openContextMenu}
            onOpenLists={() => setDrawerOpen(true)}
            inert={mainInert}
            wide={!detailTask}
          />
          {detailTask && (
            <TaskDetailPane
              task={detailTask}
              onClose={() => setSelectedTaskIds([])}
              onDeleteTask={() => deleteTasks([detailTask.id])}
              onAddStep={addStep}
              onToggleStep={setStepCompleted}
              onDeleteStep={(id) => deleteSteps([id])}
              onUpdateTask={(patch) => updateTask(detailTask.id, patch)}
              lists={lists}
              onRenameStep={renameStep}
              modal={detailModal}
            />
          )}
        </div>
      </div>
      <DragOverlay>
        <DragStack stacked={dragIds.length > 1}>{activeDrag?.clone}</DragStack>
      </DragOverlay>

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onDelete={() => deleteMenuTargets(contextMenu)}
          onUpdateTasks={(patch) => updateTasks(contextMenu.ids, patch)}
        />
      )}
    </DndContext>
  )
}
