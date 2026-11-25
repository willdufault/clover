import { useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  getClientRect,
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
import { applySort, sortTasks, type Sort, type SortCriteria } from './sort'
import { RowKind, type Step, type Task, type TaskList, type TaskPatch } from './types'
import { ALL_LIST_ID, SMART_LIST_NAMES, TODAY_LIST_ID, tasksInList } from './smartLists'
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

export default function App() {
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }))
  const [lists, setLists] = useState<TaskList[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedListId, setSelectedListId] = useState(ALL_LIST_ID)
  const [rawSelectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [sort, setSort] = useState<Sort | null>(null)
  const [activeDrag, setActiveDrag] = useState<DragInfo | null>(null)
  const [dragOverListId, setDragOverListId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const listTasks = tasksInList(tasks, selectedListId)
  const visibleTasks = sortTasks(listTasks, sort)
  const selectedList = lists.find((list) => list.id === selectedListId)
  const listName = SMART_LIST_NAMES[selectedListId] ?? selectedList?.name
  const selectedTaskIds = rawSelectedTaskIds.filter((id) => visibleTasks.some((task) => task.id === id))
  const detailTask = soleTask(visibleTasks, selectedTaskIds)
  const { drawerOpen, setDrawerOpen, detailModal, mainInert } = useOverlays(!!detailTask)

  const replaceTaskSelection = setSelectedTaskIds

  const selectList = (id: string) => {
    setSelectedListId(id)
    setSort(null)
    replaceTaskSelection([])
    setDrawerOpen(false)
  }

  const selectTask = (id: string, event: React.MouseEvent) =>
    replaceTaskSelection(
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
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [drawerOpen, setDrawerOpen])

  const updateSteps = async (patches: Partial<Step>[]) => {
    const updated: Step[] = await api('PATCH', '/steps', patches)
    setTasks((prev) =>
      prev.map((task) => ({
        ...task,
        steps: task.steps.map((step) => updated.find((other) => other.id === step.id) ?? step),
      })),
    )
  }

  const addTask = (title: string) =>
    runReportingErrors(async () => {
      const task = await api('POST', '/tasks', {
        title,
        listId: selectedList?.id ?? null,
        addedToToday: selectedListId === TODAY_LIST_ID,
      })
      setTasks((prev) => [...prev, { ...task, steps: [] }])
    })

  const addStep = (title: string) =>
    runReportingErrors(async () => {
      const step: Step = await api('POST', '/steps', { taskId: detailTask?.id, title })
      setTasks((prev) =>
        prev.map((task) => (task.id === step.taskId ? { ...task, steps: [...task.steps, step] } : task)),
      )
    })

  const deleteTasks = (ids: string[]) =>
    runReportingErrors(async () => {
      await api('DELETE', '/tasks', { ids })
      setTasks((prev) => prev.filter((task) => !ids.includes(task.id)))
      replaceTaskSelection([])
    })

  const updateTasks = (ids: string[], patch: TaskPatch) =>
    runReportingErrors(async () => {
      const updated: Omit<Task, 'steps'>[] = await api(
        'PATCH',
        '/tasks',
        ids.map((id) => ({ id, ...patch })),
      )
      setTasks((prev) => prev.map((task) => ({ ...task, ...updated.find((other) => other.id === task.id) })))
    })

  const updateTask = (id: string, patch: TaskPatch) => updateTasks([id], patch)

  const toggleDone = ({ id, stage }: Task) => updateTask(id, { stage: stage === 'done' ? 'open' : 'done' })

  const sortList = (criteria: SortCriteria | null) =>
    setSort(criteria && { criteria, descending: sort?.criteria === criteria && !sort.descending })

  const setStepCompleted = (id: string, completed: boolean) =>
    runReportingErrors(() => updateSteps([{ id, completed }]))

  const deleteSteps = (ids: string[]) =>
    runReportingErrors(async () => {
      await api('DELETE', '/steps', { ids })
      setTasks((prev) => prev.map((task) => ({ ...task, steps: task.steps.filter((step) => !ids.includes(step.id)) })))
    })

  const openContextMenu: OpenContextMenu = (kind, id) => (event) => {
    const ids = kind === RowKind.Task && selectedTaskIds.includes(id) ? selectedTaskIds : [id]
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
    if (kind === RowKind.List) ids.forEach(deleteList)
    else deleteTasks(ids)
  }

  const menuIds = contextMenu?.ids ?? []

  const renameList = (id: string, name: string) =>
    runReportingErrors(async () => {
      const [updated]: [TaskList] = await api('PATCH', '/lists', [{ id, name }])
      setLists((prev) => prev.map((list) => (list.id === id ? updated : list)))
    })

  const renameStep = (id: string, title: string) => runReportingErrors(() => updateSteps([{ id, title }]))

  const createList = (name: string) =>
    runReportingErrors(async () => {
      const newList: TaskList = await api('POST', '/lists', { name })
      setLists((prev) => [...prev, newList])
      selectList(newList.id)
    })

  const deleteList = (id: string) =>
    runReportingErrors(async () => {
      const remaining = lists.filter((list) => list.id !== id)
      const index = lists.findIndex((list) => list.id === id)
      const neighborId = (remaining[index - 1] ?? remaining[0])?.id ?? ALL_LIST_ID
      await api('DELETE', '/lists', { ids: [id] })
      setLists((prev) => prev.filter((list) => list.id !== id))
      setTasks((prev) => prev.filter((task) => task.listId !== id))
      setSelectedListId((current) => (current === id ? neighborId : current))
    })

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveDrag(active.data.current as DragInfo)
  }

  const taskDropListId = (over: Over | null) => {
    if (!over || activeDrag?.kind !== RowKind.Task) return null
    const id = String(over.id)
    return id === TODAY_LIST_ID || lists.some((list) => list.id === id) ? id : null
  }

  const handleDragOver = ({ over }: DragOverEvent) => {
    setDragOverListId(taskDropListId(over))
  }

  const resetDragState = () => {
    setActiveDrag(null)
    setDragOverListId(null)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    resetDragState()
    if (!over) return
    const targetListId = taskDropListId(over)
    if (targetListId) {
      replaceTaskSelection([])
      if (targetListId === TODAY_LIST_ID) return updateTask(String(active.id), { addedToToday: true })
      const dragged = tasks.find((task) => task.id === active.id)
      if (dragged?.listId === targetListId) return
      updateTask(String(active.id), { listId: targetListId })
      return
    }
    const taskDrag = activeDrag?.kind === RowKind.Task && active.id !== over.id
    const nextState = applyDrop(
      { lists, tasks: applySort(tasks, listTasks, taskDrag ? sort : null) },
      {
        selectedListId,
        detailTask,
        activeId: String(active.id),
        overId: String(over.id),
      },
    )
    setLists(nextState.lists)
    setTasks(nextState.tasks)
    if (taskDrag) setSort(null)
  }

  if (loading) return <p className="p-8 font-sans text-moss/80">Loading…</p>

  return (
    <DndContext
      collisionDetection={pointerWithin}
      measuring={{ draggable: { measure: measureDraggable } }}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
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
            onDeleteList={deleteList}
            tasks={visibleTasks}
            onAddTask={addTask}
            onSort={sortList}
            sort={sort}
            selectedIds={selectedTaskIds}
            menuIds={menuIds}
            onSelectTask={selectTask}
            onClearSelection={() => replaceTaskSelection([])}
            onToggleDone={toggleDone}
            onContextMenu={openContextMenu}
            onOpenLists={() => setDrawerOpen(true)}
            inert={mainInert}
            wide={!detailTask}
          />
          {detailTask && (
            <TaskDetailPane
              task={detailTask}
              onClose={() => replaceTaskSelection([])}
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
      <DragOverlay>{activeDrag?.clone}</DragOverlay>

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
