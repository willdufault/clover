import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { formatDue, isOverdue, relativeDay } from '../due'
import { PRIORITY_LABELS } from '../labels'
import { FIELD_CLASS, dueClass } from '../styles'
import { ItemKind, type Priority, type Stage, type Step, type Task } from '../types'
import { AddInput } from './AddInput'
import type { OpenMenu } from './ContextMenu'
import { SortableRow } from './SortableRow'
import { StageSelect } from './StageSelect'
import { stopDrag } from './stopDrag'

export default function DetailPanel({
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
  renderRenameInput,
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
  onContextMenu: OpenMenu
  onRename: (kind: ItemKind, id: string, text: string) => void
  renderRenameInput: (kind: ItemKind, id: string, className: string) => React.ReactNode
}) {
  const stepRow = (step: Step) => (
    <SortableRow
      key={step.id}
      id={step.id}
      kind={ItemKind.Step}
      text={step.text}
      tag="li"
      onClick={(event) => onSelectStep(step.id, event)}
      onContextMenu={onContextMenu(ItemKind.Step, step.id, step.text)}
      className={
        'group flex select-none items-center gap-3 border-b border-gray-200 py-2' +
        (selectedIds.includes(step.id) ? ' bg-gray-200' : '')
      }
    >
      <input
        type="checkbox"
        checked={step.done}
        {...stopDrag}
        onChange={() => onToggleStep(step.id)}
        className="size-4 accent-blue-500"
      />
      {renderRenameInput(
        ItemKind.Step,
        step.id,
        'min-w-0 flex-1 rounded border border-blue-400 bg-white px-1 py-0.5 text-sm text-gray-800 outline-none',
      ) || (
        <span
          onClick={(event) => {
            if (event.ctrlKey || event.metaKey || event.shiftKey) return
            event.stopPropagation()
            onRename(ItemKind.Step, step.id, step.text)
          }}
          className={
            'min-w-0 flex-1 cursor-text break-words ' +
            (step.done ? 'text-gray-400 line-through' : 'text-gray-800')
          }
        >
          {step.text}
        </span>
      )}
      <button
        {...stopDrag}
        onClick={() => onDeleteStep(step.id)}
        aria-label="Delete step"
        className="shrink-0 rounded px-1 leading-none text-gray-400 hover:text-gray-600"
      >
        ✕
      </button>
    </SortableRow>
  )

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-gray-200 bg-gray-100">
      <div className="min-w-0 flex-1 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] p-3">
      <div className="flex items-center gap-3">
        <StageSelect
          value={task.stage}
          onChange={(stage) => onSetStage(task.id, stage)}
          className="w-5 shrink-0 appearance-none overflow-hidden bg-transparent"
        />
        {renderRenameInput(
          ItemKind.Task,
          task.id,
          'field-sizing-content max-w-full min-w-8 rounded pr-8 border border-blue-400 bg-white font-semibold text-gray-800 outline-none',
        ) || (
          <h2
            onClick={() => onRename(ItemKind.Task, task.id, task.text)}
            className="w-fit max-w-full cursor-text break-words font-semibold text-gray-800"
          >
            {task.text}
          </h2>
        )}
      </div>

      <AddInput
        placeholder="+ New step"
        onAdd={onAddStep}
      />

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
