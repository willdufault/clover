import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { formatDueDate } from '../dates'
import { PRIORITY_LABELS } from '../labels'
import { isCompleted } from '../stages'
import { TITLE_RENAME_CLASS, dueDateClass } from '../styles'
import { RowKind, type Stage, type Task } from '../types'
import { AddInput } from './AddInput'
import type { OpenContextMenu } from './ContextMenu'
import { SortableRow } from './SortableRow'
import { StageSelect } from './StageSelect'

export default function TaskPane({
  selectedListId,
  listName,
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
  selectedListId: string
  listName: string | undefined
  renamable: boolean
  tasks: Task[]
  selectedIds: string[]
  onAddTask: (text: string) => void
  onSelectTask: (id: string, event: React.MouseEvent) => void
  onSetStage: (id: string, stage: Stage) => void
  onContextMenu: OpenContextMenu
  onRename: (kind: RowKind, id: string, text: string) => void
  renderRenameInput: (kind: RowKind, id: string, className: string) => React.ReactNode
}) {
  const metaItems = (task: Task) => {
    const items = []
    if (task.steps.length > 0)
      items.push(
        <span key="steps" className="text-xs text-gray-500">
          {task.steps.filter((step) => step.completed).length}/
          {task.steps.length}
        </span>,
      )
    if (task.due)
      items.push(
        <span key="due" className={dueDateClass(task.due)}>
          📅 {formatDueDate(task.due)}
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

  const taskRow = (task: Task) => {
    const meta = metaItems(task)
    return (
      <SortableRow
        key={task.id}
        id={task.id}
        kind={RowKind.Task}
        text={task.text}
        tag="li"
        onClick={(event) => onSelectTask(task.id, event)}
        onContextMenu={onContextMenu(RowKind.Task, task.id)}
        className={
          'group flex select-none items-center gap-3 border-b border-gray-100 py-2' +
          (selectedIds.includes(task.id) ? ' bg-gray-100' : '')
        }
      >
        <StageSelect
          value={task.stage}
          onChange={(stage) => onSetStage(task.id, stage)}
        />
        <div className="flex min-w-0 flex-col">
          <span
            className={
              isCompleted(task.stage)
                ? 'break-words text-gray-400 line-through'
                : 'break-words text-gray-800'
            }
          >
            {task.text}
          </span>
          {meta.length > 0 && (
            <div className="flex gap-2">
              {meta.flatMap((item, i) => [
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
  }

  return (
    <main className="min-w-0 flex-1 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] p-6">
      {renderRenameInput(
        RowKind.List,
        selectedListId,
        TITLE_RENAME_CLASS,
      ) || (
        <h1
          onClick={() => renamable && onRename(RowKind.List, selectedListId, listName ?? '')}
          className={
            'w-fit max-w-full break-words font-semibold text-gray-800' +
            (renamable ? ' cursor-text' : '')
          }
        >
          {listName}
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
