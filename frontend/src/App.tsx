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
  type Over,
} from '@dnd-kit/core'
import { api } from './api'
import { applyDrop } from './drop'
import { LISTS_PER_USER, STEPS_PER_TASK, STEPS_PER_USER, TASKS_PER_LIST, TASKS_PER_USER } from './limits'
import { nextSelection } from './selection'
import { applySort, type SortCriteria } from './sort'
import { RowKind, type Step, type Task, type TaskList, type TaskPatch } from './types'
import { ALL_LIST_ID, SMART_LIST_NAMES, TODAY_LIST_ID, tasksInList } from './smartLists'
import ContextMenu, { type ContextMenuState } from './components/ContextMenu'
import TaskDetailPane from './components/TaskDetailPane'
import ListSidebar from './components/ListSidebar'
import TaskPane from './components/TaskPane'

type DragInfo = { kind: RowKind; text: string }

export default function App() {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )
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
  const detailTask =
    selectedTaskIds.length === 1
      ? listTasks.find((task) => task.id === selectedTaskIds[0])
      : undefined
  const detailTaskId = detailTask?.id ?? null

  // Also clears step selection, which belongs to the detail task.
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

  // Awaits the API call; on failure, state is left unchanged and the error is shown.
  const run = async (action: () => Promise<void>) => {
    try {
      await action()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // Shows the error and returns true if adding one more would exceed the limit.
  const atLimit = (count: number, limit: number, message: string) => {
    if (count < limit) return false
    setError(`${message} (${limit}).`)
    return true
  }

  const listFull = (listId: string) =>
    atLimit(tasks.filter((task) => task.listId === listId).length, TASKS_PER_LIST, 'List task limit reached')

  useEffect(() => {
    run(async () => {
      const data: { lists: TaskList[]; tasks: Omit<Task, 'steps'>[]; steps: Step[] } = await api('GET', '/data')
      setLists(data.lists)
      setTasks(
        data.tasks.map((task) => ({ ...task, steps: data.steps.filter((step) => step.taskId === task.id) })),
      )
      setSelectedListId(data.lists[0]?.id ?? ALL_LIST_ID)
    }).finally(() => setLoading(false))
  }, [])

  // Escape clears all selection, unless a menu handled it or it came from a text field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if ((event.target as HTMLElement).closest('input, textarea, select')) return
      replaceTaskSelection([])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  // PATCH and DELETE take a batch and save all or nothing, so each action is one request.
  const patchTasks = async (patches: Partial<Task>[]) => {
    const updated: Omit<Task, 'steps'>[] = await api('PATCH', '/tasks', patches)
    setTasks((tasks) => tasks.map((task) => ({ ...task, ...updated.find((other) => other.id === task.id) })))
  }

  const patchSteps = async (patches: Partial<Step>[]) => {
    const updated: Step[] = await api('PATCH', '/steps', patches)
    setTasks((tasks) =>
      tasks.map((task) => ({
        ...task,
        steps: task.steps.map((step) => updated.find((other) => other.id === step.id) ?? step),
      })),
    )
  }

  const addTask = (title: string) => {
    if (atLimit(tasks.length, TASKS_PER_USER, 'Task limit reached')) return
    if (currentList && listFull(currentList.id)) return
    return run(async () => {
      const task = await api('POST', '/tasks', {
        title,
        listId: currentList?.id ?? null,
        addedToToday: selectedListId === TODAY_LIST_ID,
      })
      setTasks((tasks) => [{ ...task, steps: [] }, ...tasks])
    })
  }

  const addStep = (title: string) => {
    const stepCount = tasks.reduce((sum, task) => sum + task.steps.length, 0)
    if (atLimit(stepCount, STEPS_PER_USER, 'Step limit reached')) return
    if (atLimit(detailTask!.steps.length, STEPS_PER_TASK, 'Task step limit reached')) return
    return run(async () => {
      const step: Step = await api('POST', '/steps', { taskId: detailTaskId, title })
      setTasks((tasks) =>
        tasks.map((task) => (task.id === step.taskId ? { ...task, steps: [...task.steps, step] } : task)),
      )
    })
  }

  const deleteTasks = (ids: string[]) =>
    run(async () => {
      await api('DELETE', '/tasks', { ids })
      setTasks((tasks) => tasks.filter((task) => !ids.includes(task.id)))
      replaceTaskSelection([])
    })

  const updateTasks = (ids: string[], patch: TaskPatch) => run(() => patchTasks(ids.map((id) => ({ id, ...patch }))))

  const updateTask = (id: string, patch: TaskPatch) => updateTasks([id], patch)

  const sortList = (criteria: SortCriteria) =>
    setTasks((tasks) => applySort(tasks, listTasks, criteria))

  const setStepsCompleted = (ids: string[], completed: boolean) =>
    run(async () => {
      if (ids.length) await patchSteps(ids.map((id) => ({ id, completed })))
    })

  const deleteSteps = (ids: string[]) =>
    run(async () => {
      await api('DELETE', '/steps', { ids })
      setTasks((tasks) =>
        tasks.map((task) => ({ ...task, steps: task.steps.filter((step) => !ids.includes(step.id)) })),
      )
      setSelectedStepIds([])
    })

  const openContextMenu =
    (kind: RowKind, id: string) =>
    (event: React.MouseEvent) => {
      event.preventDefault()
      const selected = kind === RowKind.Task ? selectedTaskIds : selectedStepIds
      let ids = [id]
      if (kind !== RowKind.List && selected.includes(id)) ids = selected
      else if (kind === RowKind.Task) replaceTaskSelection(ids)
      else if (kind === RowKind.Step) setSelectedStepIds(ids)
      const menuTasks = tasks.filter((task) => ids.includes(task.id))
      const allDone = detailTask?.steps
        .filter((step) => ids.includes(step.id))
        .every((step) => step.completed)
      setMenu({
        x: event.clientX,
        y: event.clientY,
        kind,
        ids,
        hasDue: menuTasks.some((task) => task.due),
        allInToday: menuTasks.every((task) => task.addedToToday),
        allDone,
      })
    }

  const renameItem = (kind: RowKind, id: string, name: string) =>
    run(async () => {
      if (kind === RowKind.List) {
        const [updated]: TaskList[] = await api('PATCH', '/lists', [{ id, name }])
        setLists((lists) => lists.map((list) => (list.id === id ? updated : list)))
      } else if (kind === RowKind.Task) {
        await patchTasks([{ id, title: name }])
      } else {
        await patchSteps([{ id, title: name }])
      }
    })

  const createList = (name: string) => {
    if (atLimit(lists.length, LISTS_PER_USER, 'List limit reached')) return
    return run(async () => {
      const newList: TaskList = await api('POST', '/lists', { name })
      setLists((lists) => [...lists, newList])
      selectList(newList.id)
    })
  }

  // The server also deletes the list's tasks and their steps.
  const deleteList = (id: string) =>
    run(async () => {
      const remaining = lists.filter((list) => list.id !== id)
      const index = lists.findIndex((list) => list.id === id)
      const neighborId = (remaining[index - 1] ?? remaining[0])?.id ?? ALL_LIST_ID
      await api('DELETE', '/lists', { ids: [id] })
      setLists((lists) => lists.filter((list) => list.id !== id))
      setTasks((tasks) => tasks.filter((task) => task.listId !== id))
      // The deleted list's tasks and steps are gone, so stale task/step selection is harmless.
      setSelectedListId((current) => (current === id ? neighborId : current))
    })

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveDrag(active.data.current as DragInfo)
  }

  // The list id or TODAY_LIST_ID when a task is dragged over a list or Today; otherwise null.
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
    if (target === TODAY_LIST_ID) {
      replaceTaskSelection([])
      updateTask(String(active.id), { addedToToday: true })
      return
    }
    if (target) {
      replaceTaskSelection([])
      const task = tasks.find((task) => task.id === active.id)
      if (task?.listId === target || listFull(target)) return
      updateTask(String(active.id), { listId: target })
      return
    }
    const nextState = applyDrop({ lists, tasks }, {
      selectedListId,
      detailTaskId,
      activeId: String(active.id),
      overId,
    })
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
      <div className="flex h-screen overflow-hidden flex-col font-sans">
        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 bg-coral-50 px-4 py-2 text-sm text-coral">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
          </div>
        )}
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
            onRename={renameItem}
            tasks={listTasks}
            onAddTask={addTask}
            onSort={sortList}
            selectedIds={selectedTaskIds}
            onSelectTask={selectTask}
            onClearSelection={() => replaceTaskSelection([])}
            onSetStage={(id, stage) => updateTask(id, { stage })}
            onContextMenu={openContextMenu}
          />
          {detailTask && (
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
              onRename={renameItem}
            />
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
            if (menu.kind === RowKind.List) deleteList(menu.ids[0])
            else if (menu.kind === RowKind.Task) deleteTasks(menu.ids)
            else deleteSteps(menu.ids)
          }}
          onUpdate={(patch) => updateTasks(menu.ids, patch)}
          onSetStepCompleted={(completed) =>
            setStepsCompleted(
              detailTask!.steps
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
