import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { formatDue } from '../due'
import { PRIORITY_LABELS } from '../labels'
import { dueClass } from '../styles'
import { ItemKind, type Stage, type Task } from '../types'
import { AddInput } from './AddInput'
import type { OpenMenu } from './ContextMenu'
import { SortableRow } from './SortableRow'
import { StageSelect } from './StageSelect'

export default function TaskView({
  viewId,
  viewName,
  renamable,
  tasks,
  selectedIds,
  onAddTask,
  onSelectTask,
  onSetStage,
  onContextMenu,
  onRename,
  renderRenameInput,
}: {
  viewId: string
  viewName: string | undefined
  renamable: boolean
  tasks: Task[]
  selectedIds: string[]
  onAddTask: (text: string) => void
  onSelectTask: (id: string, event: React.MouseEvent) => void
  onSetStage: (id: string, stage: Stage) => void
  onContextMenu: OpenMenu
  onRename: (kind: ItemKind, id: string, text: string) => void
  renderRenameInput: (kind: ItemKind, id: string, className: string) => React.ReactNode
}) {
  const metaItems = (task: Task) => {
    const items = []
    if (task.steps.length > 0)
      items.push(
        <span key="steps" className="text-xs text-gray-500">
          {task.steps.filter((step) => step.done).length}/
          {task.steps.length}
        </span>,
      )
    if (task.due)
      items.push(
        <span key="due" className={dueClass(task.due)}>
          📅 {formatDue(task.due)}
        </span>,
      )
    if (task.priority)
      items.push(
        <span key="priority" className="text-xs text-gray-500">
          {PRIORITY_LABELS[task.priority].emoji}{' '}
          {PRIORITY_LABELS[task.priority].label} priority
        </span>,
      )
    return items
  }

  const taskRow = (task: Task) => (
    <SortableRow
      key={task.id}
      id={task.id}
      kind={ItemKind.Task}
      text={task.text}
      tag="li"
      onClick={(event) => onSelectTask(task.id, event)}
      onContextMenu={onContextMenu(ItemKind.Task, task.id, task.text, task.due)}
      className={
        'group flex select-none items-center gap-3 border-b border-gray-100 py-2' +
        (selectedIds.includes(task.id) ? ' bg-gray-100' : '')
      }
    >
      <StageSelect
        value={task.stage}
        onChange={(stage) => onSetStage(task.id, stage)}
        className="w-5 shrink-0 appearance-none overflow-hidden bg-transparent"
      />
      <div className="flex min-w-0 flex-col">
        <span
          className={
            task.stage === 'done' || task.stage === 'cancelled'
              ? 'break-words text-gray-400 line-through'
              : 'break-words text-gray-800'
          }
        >
          {task.text}
        </span>
        {metaItems(task).length > 0 && (
          <div className="flex gap-2">
            {metaItems(task).flatMap((item, i) => [
              i > 0 && (
                <span key={`dot${i}`} className="text-xs text-gray-400">
                  •
                </span>
              ),
              item,
            ])}
          </div>
        )}
      </div>
    </SortableRow>
  )

  return (
    <main className="min-w-0 flex-1 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] p-6">
      {renderRenameInput(
        ItemKind.List,
        viewId,
        'field-sizing-content max-w-full min-w-8 rounded pr-8 border border-blue-400 bg-white font-semibold text-gray-800 outline-none',
      ) || (
        <h1
          onClick={() => renamable && onRename(ItemKind.List, viewId, viewName ?? '')}
          className={
            'w-fit max-w-full break-words font-semibold text-gray-800' +
            (renamable ? ' cursor-text' : '')
          }
        >
          {viewName}
        </h1>
      )}

      <AddInput placeholder="+ New task" onAdd={onAddTask} />

      <SortableContext items={tasks} strategy={verticalListSortingStrategy}>
        <ul className="mt-4 w-full">{tasks.map(taskRow)}</ul>
      </SortableContext>

      {tasks.length === 0 && (
        <p className="mt-4 text-sm text-gray-400">No tasks yet</p>
      )}
    </main>
  )
}
