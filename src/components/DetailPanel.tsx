import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { formatDue, isOverdue, relativeDay } from '../due'
import { PRIORITY_LABELS } from '../labels'
import { FIELD_CLASS, dueClass } from '../styles'
import { ItemKind, type Priority, type Subtask, type Task } from '../types'
import { AddInput } from './AddInput'
import type { OpenMenu } from './ContextMenu'
import { SortableRow } from './SortableRow'
import { stopDrag } from './stopDrag'

export default function DetailPanel({
  task,
  selectedIds,
  onSelectSubtask,
  onClose,
  onAddSubtask,
  onToggleSubtask,
  onSetDue,
  onSetPriority,
  onContextMenu,
  renderRenameInput,
}: {
  task: Task
  selectedIds: string[]
  onSelectSubtask: (id: string, event: React.MouseEvent) => void
  onClose: () => void
  onAddSubtask: (text: string) => void
  onToggleSubtask: (id: string) => void
  onSetDue: (id: string, due?: string) => void
  onSetPriority: (id: string, priority?: Priority) => void
  onContextMenu: OpenMenu
  renderRenameInput: (kind: ItemKind, id: string, className: string) => React.ReactNode
}) {
  const subtaskRow = (subtask: Subtask) => (
    <SortableRow
      key={subtask.id}
      id={subtask.id}
      kind={ItemKind.Subtask}
      text={subtask.text}
      tag="li"
      onClick={(event) => onSelectSubtask(subtask.id, event)}
      onContextMenu={onContextMenu(ItemKind.Subtask, subtask.id, subtask.text)}
      className={
        'group flex select-none items-center gap-3 border-b border-gray-200 py-2' +
        (selectedIds.includes(subtask.id) ? ' bg-gray-200' : '')
      }
    >
      <input
        type="checkbox"
        checked={subtask.done}
        {...stopDrag}
        onChange={() => onToggleSubtask(subtask.id)}
        className="size-4 accent-blue-500"
      />
      {renderRenameInput(
        ItemKind.Subtask,
        subtask.id,
        'min-w-0 flex-1 rounded border border-blue-400 bg-white px-1 py-0.5 text-sm text-gray-800 outline-none',
      ) || (
        <span
          className={
            subtask.done ? 'text-gray-400 line-through' : 'text-gray-800'
          }
        >
          {subtask.text}
        </span>
      )}
    </SortableRow>
  )

  return (
    <aside className="w-72 shrink-0 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] border-l border-gray-200 bg-gray-100 p-3">
      <div className="flex items-center">
        <h2 className="font-semibold text-gray-800">{task.text}</h2>
        <button
          onClick={onClose}
          className="ml-auto rounded text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      <AddInput
        placeholder="Add a subtask and press Enter"
        onAdd={onAddSubtask}
      />

      <SortableContext
        items={task.subtasks}
        strategy={verticalListSortingStrategy}
      >
        <ul className="mt-4 max-h-64 w-full overflow-y-auto">
          {task.subtasks.map(subtaskRow)}
        </ul>
      </SortableContext>

      {task.subtasks.length === 0 && (
        <p className="mt-4 text-sm text-gray-400">No subtasks yet</p>
      )}

      <h3 className="mt-4 mb-1 text-xs font-medium text-gray-500">Due date</h3>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={task.due ?? ''}
          onChange={(event) => onSetDue(task.id, event.target.value || undefined)}
          className={
            FIELD_CLASS + (task.due && isOverdue(task.due) ? ' text-red-600' : '')
          }
        />
        {task.due && (
          <button
            onClick={() => onSetDue(task.id)}
            className="text-gray-400 hover:text-red-600"
          >
            ×
          </button>
        )}
      </div>
      {task.due &&
        relativeDay(task.due) && (
          <p className={'mt-1 ' + dueClass(task.due)}>{formatDue(task.due)}</p>
        )}
      <h3 className="mt-4 mb-1 text-xs font-medium text-gray-500">Priority</h3>
      <select
        value={task.priority ?? ''}
        onChange={(event) =>
          onSetPriority(
            task.id,
            (event.target.value || undefined) as Priority | undefined,
          )
        }
        className={FIELD_CLASS}
      >
        <option value="low">
          {PRIORITY_LABELS.low.emoji} {PRIORITY_LABELS.low.label}
        </option>
        <option value="">Medium</option>
        <option value="high">
          {PRIORITY_LABELS.high.emoji} {PRIORITY_LABELS.high.label}
        </option>
      </select>
    </aside>
  )
}
