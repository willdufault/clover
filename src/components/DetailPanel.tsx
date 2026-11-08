import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { formatDue, isOverdue, relativeDay } from '../due'
import type { Priority, Stage, Subtask, Task } from '../drop'
import { FIELD, ItemType, PRIORITY, STAGE, dueClass } from '../shared'
import type { OpenMenu } from './ContextMenu'
import { AddInput, SortableRow, stopDrag } from './rows'

export default function DetailPanel({
  task,
  onClose,
  onAddSubtask,
  onToggleSubtask,
  onSetStage,
  onSetDue,
  onSetPriority,
  onContextMenu,
  renameBox,
}: {
  task: Task
  onClose: () => void
  onAddSubtask: (text: string) => void
  onToggleSubtask: (id: string) => void
  onSetStage: (id: string, stage?: Stage) => void
  onSetDue: (id: string, due?: string) => void
  onSetPriority: (id: string, priority?: Priority) => void
  onContextMenu: OpenMenu
  renameBox: (kind: ItemType, id: string, className: string) => React.ReactNode
}) {
  const subtaskRow = (subtask: Subtask) => (
    <SortableRow
      key={subtask.id}
      id={subtask.id}
      kind={ItemType.Subtask}
      text={subtask.text}
      tag="li"
      onContextMenu={onContextMenu(ItemType.Subtask, subtask.id, subtask.text)}
      className="group flex select-none items-center gap-3 border-b border-gray-200 py-2"
    >
      <input
        type="checkbox"
        checked={subtask.done}
        {...stopDrag}
        onChange={() => onToggleSubtask(subtask.id)}
        className="size-4 accent-blue-500"
      />
      {renameBox(
        ItemType.Subtask,
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

      <h3 className="mt-4 mb-1 text-xs font-medium text-gray-500">Stage</h3>
      <select
        value={task.stage ?? ''}
        onChange={(e) =>
          onSetStage(task.id, (e.target.value || undefined) as Stage | undefined)
        }
        className={FIELD}
      >
        <option value="">⬜ Open</option>
        {(Object.keys(STAGE) as Stage[]).map((stage) => (
          <option key={stage} value={stage}>
            {STAGE[stage].emoji} {STAGE[stage].label}
          </option>
        ))}
      </select>
      <h3 className="mt-4 mb-1 text-xs font-medium text-gray-500">Due date</h3>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={task.due ?? ''}
          onChange={(e) => onSetDue(task.id, e.target.value || undefined)}
          className={
            FIELD + (task.due && isOverdue(task.due) ? ' text-red-600' : '')
          }
        />
        {task.due && (
          <button
            onClick={() => onSetDue(task.id)}
            className="text-gray-500 hover:text-gray-800"
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
        onChange={(e) =>
          onSetPriority(
            task.id,
            (e.target.value || undefined) as Priority | undefined,
          )
        }
        className={FIELD}
      >
        <option value="low">
          {PRIORITY.low.emoji} {PRIORITY.low.label}
        </option>
        <option value="">Medium</option>
        <option value="high">
          {PRIORITY.high.emoji} {PRIORITY.high.label}
        </option>
      </select>
    </aside>
  )
}
