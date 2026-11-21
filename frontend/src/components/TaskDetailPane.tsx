import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { isOverdue, relativeDayLabel } from '../dates'
import { PRIORITIES, PRIORITY_LABELS, STAGES, STAGE_LABELS, labelText } from '../labels'
import { FIELD_CLASS, X_BUTTON_CLASS, SELECTED_ROW_CLASS, dueDateClass } from '../styles'
import { RowKind, type Priority, type Stage, type Step, type Task, type TaskPatch } from '../types'
import type { OpenContextMenu } from './ContextMenu'
import { AddInput } from './AddInput'
import limits from '../../../backend/limits.json'
import { EditableText } from './EditableText'
import { SortableRow } from './SortableRow'
import { TaskSummary } from './TaskSummary'
import { ignoreRowEvents } from './ignoreRowEvents'

const LABEL_CLASS = 'mt-5 mb-2 px-1 text-xs font-semibold tracking-[0.07em] text-ink-soft uppercase'

function DueDateField({ task, onUpdate }: { task: Task; onUpdate: (patch: TaskPatch) => void }) {
  const dueLabel = task.due && relativeDayLabel(task.due)
  return (
    <div
      className={
        FIELD_CLASS +
        ' group relative gap-2 pr-2 focus-within:border-clover-400' +
        (task.due && isOverdue(task.due) ? ' text-coral' : '')
      }
    >
      <input
        type="date"
        // Uncontrolled so typing doesn't save each partial date; saves once on blur or Enter.
        key={task.id + (task.due ?? '')}
        defaultValue={task.due ?? ''}
        onBlur={(event) => {
          // A partly cleared date reads as '' but sets badInput; skip it so it doesn't delete the date.
          const { value } = event.target
          const partial = event.target.validity.badInput
          // Show the saved date until the save succeeds; then the key changes and the input remounts.
          event.target.value = task.due ?? ''
          if (!partial && value !== (task.due ?? '')) onUpdate({ due: value || null })
        }}
        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        className={'min-w-0 flex-1 bg-transparent outline-none' + (task.due ? '' : ' text-transparent focus:text-ink')}
      />
      {task.due ? (
        <>
          {dueLabel && <span className={'shrink-0 ' + dueDateClass(task.due)}>{dueLabel}</span>}
          <button onClick={() => onUpdate({ due: null })} className={X_BUTTON_CLASS + ' text-ink-soft'}>
            ×
          </button>
        </>
      ) : (
        <span className="pointer-events-none absolute left-3.5 text-ink-faint group-focus-within:hidden">
          No due date
        </span>
      )}
    </div>
  )
}

export default function TaskDetailPane({
  task,
  selectedIds,
  onSelectStep,
  onClose,
  onDeleteTask,
  onAddStep,
  onToggleStep,
  onDeleteStep,
  onUpdate,
  onContextMenu,
  onRenameStep,
}: {
  task: Task
  selectedIds: string[]
  onSelectStep: (id: string, event: React.MouseEvent) => void
  onClose: () => void
  onDeleteTask: () => void
  onAddStep: (text: string) => void
  onToggleStep: (id: string, completed: boolean) => void
  onDeleteStep: (id: string) => void
  onUpdate: (patch: TaskPatch) => void
  onContextMenu: OpenContextMenu
  onRenameStep: (id: string, text: string) => void
}) {
  const stepRow = (step: Step) => (
    <SortableRow
      key={step.id}
      id={step.id}
      kind={RowKind.Step}
      text={step.title}
      tag="li"
      onClick={(event) => onSelectStep(step.id, event)}
      onContextMenu={onContextMenu(RowKind.Step, step.id)}
      className={
        'group flex select-none items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition' +
        (selectedIds.includes(step.id) ? ' ' + SELECTED_ROW_CLASS : ' hover:bg-milk')
      }
    >
      <input
        type="checkbox"
        checked={step.completed}
        {...ignoreRowEvents}
        onChange={() => onToggleStep(step.id, !step.completed)}
        className="check"
      />
      <EditableText
        tag="span"
        text={step.title}
        maxLength={limits.titleMax}
        selectOnModifierClick
        onCommit={(name) => onRenameStep(step.id, name)}
        className={'min-w-0 flex-1 break-words ' + (step.completed ? 'text-ink-faint line-through' : 'text-ink')}
        inputClassName="min-w-0 flex-1 rounded-lg border border-clover-400 bg-paper px-1 py-0.5 text-sm text-ink outline-none"
      />
      <button
        onPointerDown={ignoreRowEvents.onPointerDown}
        onClick={(event) => {
          event.stopPropagation()
          onDeleteStep(step.id)
        }}
        aria-label="Delete step"
        className="shrink-0 rounded-full px-1 text-xs leading-none text-ink-faint opacity-0 transition group-hover:opacity-100 hover:text-coral"
      >
        ✕
      </button>
    </SortableRow>
  )

  return (
    <aside className="pane-in flex w-80 shrink-0 flex-col border-l border-line bg-paper">
      <div className="flex select-none items-start gap-3 px-5 pt-[3.6rem] pb-2">
        <TaskSummary
          key={task.id}
          task={task}
          heading
          onSetStage={(stage) => onUpdate({ stage })}
          onRename={(_id, title) => onUpdate({ title })}
        />
        <button onClick={onClose} aria-label="Close panel" className={X_BUTTON_CLASS + ' mt-0.5 -mr-1.5 text-ink-soft'}>
          ✕
        </button>
      </div>

      <div className="min-w-0 flex-1 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] px-4 pt-1 pb-4">
        <h3 className={LABEL_CLASS}>Steps</h3>
        <SortableContext items={task.steps} strategy={verticalListSortingStrategy}>
          <ul className="w-full">{task.steps.map(stepRow)}</ul>
        </SortableContext>

        <AddInput
          placeholder="+ New step"
          maxLength={limits.titleMax}
          onAdd={onAddStep}
          className={task.steps.length > 0 ? 'mt-2' : undefined}
        />
        <h3 className={LABEL_CLASS + ' mt-7'}>Schedule</h3>
        <DueDateField task={task} onUpdate={onUpdate} />
        {task.addedToToday ? (
          <div className="mt-2.5 flex h-9 w-fit items-center gap-1 rounded-full border border-clover-200 bg-clover-100 pr-1.5 pl-4 text-sm font-medium text-clover-700">
            <span>☀️ Added to Today</span>
            <button
              onClick={() => onUpdate({ addedToToday: false })}
              aria-label="Remove from Today"
              className={X_BUTTON_CLASS + ' text-clover-700'}
            >
              ×
            </button>
          </div>
        ) : (
          <button
            onClick={() => onUpdate({ addedToToday: true })}
            className="mt-2.5 flex h-9 w-fit items-center rounded-full border border-clover-200 px-4 text-sm text-clover-700 transition hover:bg-clover-50"
          >
            ☀️ Add to Today
          </button>
        )}
        <h3 className={LABEL_CLASS + ' mt-7'}>Stage</h3>
        <select
          value={task.stage}
          onChange={(event) => onUpdate({ stage: event.target.value as Stage })}
          className={FIELD_CLASS + ' field'}
        >
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {labelText(STAGE_LABELS[stage])}
            </option>
          ))}
        </select>
        <h3 className={LABEL_CLASS}>Priority</h3>
        <select
          value={task.priority}
          onChange={(event) => onUpdate({ priority: event.target.value as Priority })}
          className={FIELD_CLASS + ' field'}
        >
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {labelText(PRIORITY_LABELS[priority])}
            </option>
          ))}
        </select>
      </div>
      <div className="shrink-0 border-t border-line px-4 py-2.5">
        <button
          onClick={onDeleteTask}
          className="-ml-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-coral transition hover:bg-coral-50"
        >
          <svg
            viewBox="0 0 16 16"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />
          </svg>
          Delete task
        </button>
      </div>
    </aside>
  )
}
