import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { formatDueDate } from '../dates'
import { PRIORITY_LABELS } from '../labels'
import { isCompleted } from '../stages'
import { SELECTED_ROW_CLASS, TITLE_RENAME_CLASS, X_BUTTON_CLASS, dueDateClass } from '../styles'
import type { SortCriteria } from '../sort'
import { RowKind, type Stage, type Task } from '../types'
import { AddInput } from './AddInput'
import { EditableText } from './EditableText'
import type { OpenContextMenu } from './ContextMenu'
import { SortableRow } from './SortableRow'
import { SortMenu } from './SortMenu'
import { StageSelect } from './StageSelect'

export default function TaskPane({
  selectedListId,
  listName,
  renamable,
  tasks,
  selectedIds,
  onAddTask,
  onSort,
  onSelectTask,
  onClearSelection,
  accent,
  onSetStage,
  onContextMenu,
  onRename,
}: {
  selectedListId: string
  listName: string | undefined
  renamable: boolean
  tasks: Task[]
  selectedIds: string[]
  onAddTask: (text: string) => void
  onSort: (criteria: SortCriteria) => void
  onSelectTask: (id: string, event: React.MouseEvent) => void
  onClearSelection: () => void
  accent: string
  onSetStage: (id: string, stage: Stage) => void
  onContextMenu: OpenContextMenu
  onRename: (kind: RowKind, id: string, text: string) => void
}) {
  const metaItems = (task: Task) => {
    const items = []
    if (task.addedToToday)
      items.push(
        <span key="today" className="text-[13.5px] text-ink-soft">
          ☀️ Today
        </span>,
      )
    if (task.steps.length > 0)
      items.push(
        <span key="steps" className="text-[13.5px] text-ink-soft">
          {task.steps.filter((step) => step.completed).length}/
          {task.steps.length} steps
        </span>,
      )
    if (task.due)
      items.push(
        <span key="due" className={dueDateClass(task.due)}>
          📅 {formatDueDate(task.due)}
        </span>,
      )
    if (task.priority !== 'medium')
      items.push(
        <span key="priority" className="text-[13.5px] text-ink-soft">
          {PRIORITY_LABELS[task.priority].emoji}{' '}
          {PRIORITY_LABELS[task.priority].label}
        </span>,
      )
    return items
  }

  const doneCount = tasks.filter((task) => isCompleted(task.stage)).length

  const taskRow = (task: Task) => {
    const meta = metaItems(task)
    const selected = selectedIds.includes(task.id)
    let rowTint = 'hover:bg-milk/70'
    if (selected) rowTint = SELECTED_ROW_CLASS
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
          'group relative flex select-none items-center gap-3.5 border-b px-5 py-3.5 last:border-b-0 ' +
          'border-line/70 ' +
          rowTint
        }
      >
        {selected && <span className="absolute inset-y-0 left-0 w-[3px] bg-clover-500" />}
        <svg viewBox="0 0 16 16" className="absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-faint opacity-0 transition group-hover:opacity-100" fill="currentColor" aria-hidden="true"><circle cx="6" cy="4" r="1.2" /><circle cx="10" cy="4" r="1.2" /><circle cx="6" cy="8" r="1.2" /><circle cx="10" cy="8" r="1.2" /><circle cx="6" cy="12" r="1.2" /><circle cx="10" cy="12" r="1.2" /></svg>
        <StageSelect
          value={task.stage}
          onChange={(stage) => onSetStage(task.id, stage)}
        />
        <div className="flex min-w-0 flex-col">
          <span
            className={
              isCompleted(task.stage)
                ? 'break-words text-base text-ink-faint line-through decoration-ink-faint/50'
                : 'break-words text-base font-medium text-ink'
            }
          >
            {task.text}
          </span>
          {meta.length > 0 && (
            <div className="mt-1 flex gap-3">
              {meta}
            </div>
          )}
        </div>
      </SortableRow>
    )
  }

  return (
    <main className="relative min-w-0 flex-1 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] px-8 pt-14 pb-10">
      <svg viewBox="0 0 100 100" aria-hidden="true" className="pointer-events-none absolute right-10 bottom-8 size-44 text-clover-200/60">
        <g fill="currentColor">
          <path d="M50 48C44 34 30 30 26 40s8 18 24 8Z" />
          <path d="M52 50c14-6 18-20 8-24s-18 8-8 24Z" />
          <path d="M50 52c6 14 20 18 24 8s-8-18-24-8Z" />
          <path d="M48 50c-14 6-18 20-8 24s18-8 8-24Z" />
        </g>
        <path d="M51 53c3 12 8 22 16 30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <div className="w-full max-w-[50rem]">
      <div>
        <EditableText
          key={selectedListId}
          tag="h1"
          text={listName ?? ''}
          editable={renamable}
          onCommit={(name) => onRename(RowKind.List, selectedListId, name)}
          className={"-mx-1.5 w-fit max-w-full break-words rounded-lg px-1.5 text-4xl font-semibold tracking-tight text-ink" + (renamable ? " transition hover:bg-cream" : "")}
          inputClassName={TITLE_RENAME_CLASS + ' text-4xl tracking-tight'}
        />
        <div className="mt-3 flex items-center gap-2">
          {tasks.length > 0 && (
            <span className="mr-2 flex items-center gap-2.5 text-sm font-medium text-ink-soft">
              <span className="h-2 w-24 overflow-hidden rounded-full" style={{ background: '#ebe1c4' }}>
                <span className="block h-full rounded-full" style={{ width: `${(doneCount / tasks.length) * 100}%`, background: accent }} />
              </span>
              {doneCount} of {tasks.length} done
            </span>
          )}
          {selectedIds.length > 1 && (
            <span className="order-last flex items-center gap-1 rounded-full border border-clover-200 bg-clover-100 py-0.5 pr-0.5 pl-3 text-sm font-medium text-clover-700">
              {selectedIds.length} selected
              <button
                onClick={onClearSelection}
                aria-label="Clear selection"
                className={X_BUTTON_CLASS + " size-5! text-clover-700"}
              >
                ×
              </button>
            </span>
          )}
          <SortMenu onSort={onSort} />
        </div>
      </div>

      <AddInput placeholder="+ New task" onAdd={onAddTask} className="mt-6" />

      <SortableContext items={tasks} strategy={verticalListSortingStrategy}>
        {tasks.length > 0 && (
          <ul className="mt-5 w-full overflow-hidden rounded-[22px] border border-line bg-paper shadow-[0_8px_24px_-14px_rgba(84,66,30,0.25)]">{tasks.map(taskRow)}</ul>
        )}
      </SortableContext>

      {tasks.length > 1 && (
        <p className="mt-2.5 px-5 text-[13px] text-ink-soft">Drag to reorder. Right-click a task for more actions.</p>
      )}

      {tasks.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-faint">No tasks yet. Add one above.</p>
      )}
      </div>
    </main>
  )
}
