import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { formatDueDate, isOverdue, relativeDayLabel } from '../dates'
import { PRIORITY_LABELS } from '../labels'
import { isCompleted } from '../stages'
import { FIELD_CLASS, TITLE_RENAME_CLASS, dueDateClass } from '../styles'
import { RowKind, type Priority, type Stage, type Step, type Task } from '../types'
import type { OpenContextMenu } from './ContextMenu'
import { AddInput } from './AddInput'
import { EditableText } from './EditableText'
import { SortableRow } from './SortableRow'
import { StageSelect } from './StageSelect'
import { ignoreRowEvents } from './ignoreRowEvents'

export default function TaskDetailPane({
  task,
  selectedIds,
  onSelectStep,
  onClose,
  onDeleteTask,
  onAddStep,
  onToggleStep,
  onDeleteStep,
  onSetDue,
  onSetPriority,
  onSetStage,
  onContextMenu,
  onRename,
}: {
  task: Task
  selectedIds: string[]
  onSelectStep: (id: string, event: React.MouseEvent) => void
  onClose: () => void
  onDeleteTask: () => void
  onAddStep: (text: string) => void
  onToggleStep: (id: string) => void
  onDeleteStep: (id: string) => void
  onSetDue: (id: string, due?: string) => void
  onSetPriority: (id: string, priority?: Priority) => void
  onSetStage: (id: string, stage: Stage) => void
  onContextMenu: OpenContextMenu
  onRename: (kind: RowKind, id: string, text: string) => void
}) {
  const stepRow = (step: Step) => (
    <SortableRow
      key={step.id}
      id={step.id}
      kind={RowKind.Step}
      text={step.text}
      tag="li"
      onClick={(event) => onSelectStep(step.id, event)}
      onContextMenu={onContextMenu(RowKind.Step, step.id)}
      className={
        'group flex select-none items-center gap-3 border-b border-gray-200 py-2' +
        (selectedIds.includes(step.id) ? ' bg-gray-200' : '')
      }
    >
      <input
        type="checkbox"
        checked={step.completed}
        {...ignoreRowEvents}
        onChange={() => onToggleStep(step.id)}
        className="size-4 accent-blue-500"
      />
      <EditableText
        tag="span"
        text={step.text}
        selectOnModifierClick
        onCommit={(name) => onRename(RowKind.Step, step.id, name)}
        className={
          'min-w-0 flex-1 break-words ' +
          (step.completed ? 'text-gray-400 line-through' : 'text-gray-800')
        }
        inputClassName="min-w-0 flex-1 rounded border border-blue-400 bg-white px-1 py-0.5 text-sm text-gray-800 outline-none"
      />
      <button
        onPointerDown={ignoreRowEvents.onPointerDown}
        onClick={(event) => {
          event.stopPropagation()
          onDeleteStep(step.id)
        }}
        aria-label="Delete step"
        className="shrink-0 rounded px-1 leading-none text-gray-400 hover:text-gray-600"
      >
        ✕
      </button>
    </SortableRow>
  )

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-gray-200 bg-gray-100">
      <div className="flex select-none items-center gap-3 m-3 mb-0 rounded-md bg-white px-4 py-3">
        <StageSelect
          value={task.stage}
          onChange={(stage) => onSetStage(task.id, stage)}
        />
        <EditableText
          key={task.id}
          tag="h2"
          text={task.text}
          onCommit={(name) => onRename(RowKind.Task, task.id, name)}
          className={
            'w-fit max-w-full break-words font-semibold ' +
            (isCompleted(task.stage)
              ? 'text-gray-400 line-through'
              : 'text-gray-800')
          }
          inputClassName={TITLE_RENAME_CLASS}
        />
      </div>

      <div className="min-w-0 flex-1 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] px-3 pb-3">
      <SortableContext
        items={task.steps}
        strategy={verticalListSortingStrategy}
      >
        <ul className="mt-4 w-full">
          {task.steps.map(stepRow)}
        </ul>
      </SortableContext>

      {task.steps.length === 0 && (
        <p className="mt-4 text-sm text-gray-400">No steps yet</p>
      )}

      <AddInput placeholder="+ New step" onAdd={onAddStep} />

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
            className="flex h-4 w-4 items-center justify-center self-center text-sm leading-none text-gray-400 hover:text-red-600"
          >
            ×
          </button>
        )}
      </div>
      {task.due &&
        relativeDayLabel(task.due) && (
          <p className={'mt-1 ' + dueDateClass(task.due)}>{formatDueDate(task.due)}</p>
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
      </div>
      <div className="shrink-0 px-3 pb-3">
        <hr className="mb-2 border-gray-300" />
        <div className="flex justify-between">
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="rounded pr-2 text-2xl leading-none text-gray-400 hover:text-gray-600"
          >
            ›
          </button>
          <button
            onClick={onDeleteTask}
            aria-label="Delete task"
            className="rounded px-1 leading-none text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
      </div>
    </aside>
  )
}
