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
  type DragMoveEvent,
  type DragStartEvent,
  type Over,
} from '@dnd-kit/core'
import { getEventCoordinates } from '@dnd-kit/utilities'
import { api } from './api'
import { applyDrop, idsToMove, movedToList, orderPatches } from './drop'
import { hasModifier, nextSelection } from './selection'
import { byOrder, nextOrder, sortTasks, type SortCriteria } from './sort'
import { RowKind, type Step, type Task, type TaskList, type TaskPatch } from './types'
import { ALL_LIST_ID, SMART_LIST_NAMES, neighborListId, TODAY_LIST_ID, tasksInList } from './smartLists'
import ContextMenu, { type ContextMenuState, type OpenContextMenu } from './components/ContextMenu'
import TaskDetailPane from './components/TaskDetailPane'
import ListSidebar from './components/ListSidebar'
import TaskPane from './components/TaskPane'
import { DropAfterContext } from './components/SortableRow'
import { ICON_BUTTON_CLASS, SAFE_AREA_CLASS, rowStateClass } from './styles'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { useOverlays } from './useOverlays'

type DragInfo = { kind: RowKind; clone: React.ReactNode }

const lastRects = new WeakMap<HTMLElement, ReturnType<typeof getClientRect>>()
const measureDraggable = (node: HTMLElement) => {
  if (node.offsetParent) lastRects.set(node, getClientRect(node))
  return lastRects.get(node) ?? getClientRect(node)
}

const isDropAfter = ({ activatorEvent, delta, over }: DragMoveEvent) => {
  const start = getEventCoordinates(activatorEvent)
  return !!over && !!start && start.y + delta.y > over.rect.top + over.rect.height / 2
}

const clickModifiers = (event: React.MouseEvent) => ({
  ctrl: event.ctrlKey || event.metaKey,
  shift: event.shiftKey,
})

const soleTask = (tasks: Task[], ids: string[]) =>
  ids.length === 1 ? tasks.find((task) => task.id === ids[0]) : undefined

const useStepSelection = (task: Task | undefined) => {
  const taskId = task?.id
  const [selection, setSelection] = useState({ taskId, ids: [] as string[] })
  if (selection.taskId !== taskId) setSelection({ taskId, ids: [] })
  const steps = task?.steps ?? []
  const ids = selection.ids.filter((id) => steps.some((step) => step.id === id))
  const select = (next: string[]) => setSelection({ taskId, ids: next })
  return [steps, ids, select] as const
}

const shared = <T,>(values: T[]) => (values.every((value) => value === values[0]) ? values[0] : undefined)

const DragStack = ({ stacked, children }: { stacked: boolean; children: React.ReactNode }) => (
  <div className="relative h-full opacity-80">
    {stacked && (
      <div
        className={'absolute inset-0 translate-x-2 translate-y-2 rounded-lg shadow-md ' + rowStateClass(true, false)}
      />
    )}
    <div className="relative h-full">{children}</div>
  </div>
)

const toggledStage = (stage: string) => (stage === 'done' ? 'open' : 'done')

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
  const [dropAfter, setDropAfter] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const visibleTasks = sortTasks(tasksInList(tasks, selectedListId), sort)
  const selectedList = lists.find((list) => list.id === selectedListId)
  const listName = SMART_LIST_NAMES[selectedListId] ?? selectedList?.name
  const selectedTaskIds = rawSelectedTaskIds.filter((id) => visibleTasks.some((task) => task.id === id))
  const detailTask = soleTask(visibleTasks, selectedTaskIds)
  const [detailSteps, selectedStepIds, setSelectedStepIds] = useStepSelection(detailTask)
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

  const selectStep = (id: string, event: React.MouseEvent) => {
    const ids = detailSteps.map((step) => step.id)
    setSelectedStepIds(hasModifier(event) ? nextSelection(selectedStepIds, ids, id, clickModifiers(event)) : [])
  }

  const runReportingErrors = (action: () => Promise<void>) => {
    action().catch((e) => setError((e as Error).message))
  }

  useEffect(() => {
    api<{ lists: TaskList[]; tasks: Omit<Task, 'steps'>[]; steps: Step[] }>('GET', '/data')
      .then((data) => {
        const steps = byOrder(data.steps)
        setLists(byOrder(data.lists))
        setTasks(
          byOrder(data.tasks).map((task) => ({ ...task, steps: steps.filter((step) => step.taskId === task.id) })),
        )
        setSelectedListId(data.lists[0]?.id ?? ALL_LIST_ID)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const hasStepSelection = selectedStepIds.length > 0
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if ((event.target as HTMLElement).closest('input, textarea, select')) return
      if (drawerOpen) return setDrawerOpen(false)
      if (hasStepSelection) return setSelectedStepIds([])
      setSelectedTaskIds([])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen, setDrawerOpen, hasStepSelection, setSelectedStepIds])

  const patchSteps = async (patches: Partial<Step>[]) => {
    const updated = await api<Step[]>('PATCH', '/steps', patches)
    setTasks((prev) =>
      prev.map((task) => ({
        ...task,
        steps: byOrder(task.steps.map((step) => updated.find((other) => other.id === step.id) ?? step)),
      })),
    )
  }

  const patchTasks = async (patches: (TaskPatch & { id: string })[]) => {
    const updated = await api<Omit<Task, 'steps'>[]>('PATCH', '/tasks', patches)
    setTasks((prev) => byOrder(prev.map((task) => ({ ...task, ...updated.find((other) => other.id === task.id) }))))
  }

  const patchLists = async (patches: Partial<TaskList>[]) => {
    const updated = await api<TaskList[]>('PATCH', '/lists', patches)
    setLists((prev) => byOrder(prev.map((list) => updated.find((other) => other.id === list.id) ?? list)))
  }

  const addTask = (title: string) =>
    runReportingErrors(async () => {
      const task = await api<Omit<Task, 'steps'>>('POST', '/tasks', {
        title,
        listId: selectedList?.id ?? null,
        addedToToday: selectedListId === TODAY_LIST_ID,
        order: nextOrder(tasks),
      })
      setTasks((prev) => byOrder([...prev, { ...task, steps: [] }]))
    })

  const addStep = (title: string) =>
    runReportingErrors(async () => {
      const step = await api<Step>('POST', '/steps', { taskId: detailTask?.id, title, order: nextOrder(detailSteps) })
      setTasks((prev) =>
        prev.map((task) => (task.id === step.taskId ? { ...task, steps: byOrder([...task.steps, step]) } : task)),
      )
    })

  const deleteTasks = (ids: string[]) =>
    runReportingErrors(async () => {
      await api('DELETE', '/tasks', { ids })
      setTasks((prev) => prev.filter((task) => !ids.includes(task.id)))
      setSelectedTaskIds([])
    })

  const updateTasks = (ids: string[], patch: TaskPatch) =>
    runReportingErrors(() => patchTasks(ids.map((id) => ({ id, ...patch }))))

  const updateTask = (id: string, patch: TaskPatch) => updateTasks([id], patch)

  const toggleDone = ({ id, stage }: Task) => updateTask(id, { stage: toggledStage(stage) })

  const setStepsStage = (ids: string[], stage: string) =>
    runReportingErrors(() => patchSteps(ids.map((id) => ({ id, stage }))))

  const toggleStepDone = ({ id, stage }: Step) => setStepsStage([id], toggledStage(stage))

  const deleteSteps = (ids: string[]) =>
    runReportingErrors(async () => {
      await api('DELETE', '/steps', { ids })
      setTasks((prev) => prev.map((task) => ({ ...task, steps: task.steps.filter((step) => !ids.includes(step.id)) })))
    })

  const selections = {
    [RowKind.List]: [] as string[],
    [RowKind.Task]: selectedTaskIds,
    [RowKind.Step]: selectedStepIds,
  }
  const actionIds = (kind: RowKind, id: string) => (selections[kind].includes(id) ? selections[kind] : [id])

  const openContextMenu: OpenContextMenu = (kind, id) => (event) => {
    const ids = actionIds(kind, id)
    const menuTasks = tasks.filter((task) => ids.includes(task.id))
    const menuSteps = detailSteps.filter((step) => ids.includes(step.id))
    const names = {
      [RowKind.List]: lists.find((list) => list.id === id)?.name,
      [RowKind.Task]: menuTasks[0]?.title,
      [RowKind.Step]: menuSteps[0]?.title,
    }
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      above: event.above,
      kind,
      ids,
      title: ids.length > 1 ? `${ids.length} ${kind}s` : names[kind],
      moveTargets: lists.filter((list) => !menuTasks.every((task) => task.listId === list.id)),
      anyHasDue: menuTasks.some((task) => task.due),
      allInToday: menuTasks.every((task) => task.addedToToday),
      stage: shared((kind === RowKind.Step ? menuSteps : menuTasks).map((item) => item.stage)),
      priority: shared(menuTasks.map((task) => task.priority)),
      due: shared(menuTasks.map((task) => task.due)),
    })
  }

  const deleteMenuTargets = ({ kind, ids }: ContextMenuState) =>
    ({ [RowKind.List]: deleteLists, [RowKind.Task]: deleteTasks, [RowKind.Step]: deleteSteps })[kind](ids)

  const menuIds = contextMenu?.ids ?? []

  const renameList = (id: string, name: string) => runReportingErrors(() => patchLists([{ id, name }]))

  const renameStep = (id: string, title: string) => runReportingErrors(() => patchSteps([{ id, title }]))

  const createList = (name: string) =>
    runReportingErrors(async () => {
      const newList = await api<TaskList>('POST', '/lists', { name, order: nextOrder(lists) })
      setLists((prev) => byOrder([...prev, newList]))
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

  const updateDropTarget = (event: DragMoveEvent) => {
    setDragOverListId(taskDropListId(event.over))
    setDropAfter(isDropAfter(event))
  }

  const handleDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    const drag = active.data.current as DragInfo
    const touch = activatorEvent.type === 'touchstart'
    setActiveDrag({ ...drag, touch })
    setDragIds(touch || drag.kind === RowKind.Step ? [String(active.id)] : actionIds(drag.kind, String(active.id)))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    resetDragState()
    if (!over) return
    const targetListId = taskDropListId(over)
    if (targetListId) {
      setSelectedTaskIds([])
      const ids = idsToMove(tasks, dragIds, targetListId)
      if (ids.length === 0) return
      if (targetListId === TODAY_LIST_ID) return updateTasks(ids, { addedToToday: true })
      // The view shows the highest order first, so orders below the list's lowest put the tasks at its bottom.
      return runReportingErrors(() => patchTasks(movedToList(tasks, ids, targetListId)))
    }
    const drop = applyDrop(
      { lists, tasks },
      {
        selectedListId,
        detailTask,
        activeId: String(active.id),
        dragIds,
        overId: String(over.id),
        after: isDropAfter(event),
      },
    )
    const patches = drop ? orderPatches(drop.items) : []
    if (!drop || patches.length === 0) return
    const patchers = { [RowKind.List]: patchLists, [RowKind.Task]: patchTasks, [RowKind.Step]: patchSteps }
    runReportingErrors(() => patchers[drop.kind](patches))
  }

  if (loading) return <p className="p-8 font-sans text-moss/80">Loading…</p>

  return (
    <DndContext
      collisionDetection={pointerWithin}
      measuring={{ draggable: { measure: measureDraggable } }}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={updateDropTarget}
      onDragOver={updateDropTarget}
      onDragEnd={handleDragEnd}
      onDragCancel={resetDragState}
    >
      <DropAfterContext value={dropAfter}>
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
          <div className="flex min-h-0 w-full flex-1">
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
                onToggleStep={toggleStepDone}
                onDeleteStep={(id) => deleteSteps([id])}
                onUpdateTask={(patch) => updateTask(detailTask.id, patch)}
                lists={lists}
                onRenameStep={renameStep}
                selectedStepIds={selectedStepIds}
                menuIds={menuIds}
                onSelectStep={selectStep}
                onContextMenu={openContextMenu}
                modal={detailModal}
              />
            )}
          </div>
        </div>
      </DropAfterContext>
      <DragOverlay>
        <DragStack stacked={dragIds.length > 1}>{activeDrag?.clone}</DragStack>
      </DragOverlay>

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onDelete={() => deleteMenuTargets(contextMenu)}
          onUpdateTasks={(patch) => updateTasks(contextMenu.ids, patch)}
          onSetStepsStage={(stage) => setStepsStage(contextMenu.ids, stage)}
        />
      )}
    </DndContext>
  )
}
