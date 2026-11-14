import { isCompleted } from '../stages'
import { TITLE_RENAME_CLASS } from '../styles'
import { RowKind, type Stage, type Task } from '../types'
import { EditableText } from './EditableText'
import { StageSelect } from './StageSelect'

// Stage dropdown + title, shared by the task row and the detail pane header.
// The header variant is larger and its title is renamable.
export function TaskSummary({
  task,
  heading = false,
  onSetStage,
  onRename,
  children,
}: {
  task: Task
  heading?: boolean
  onSetStage: (id: string, stage: Stage) => void
  onRename?: (kind: RowKind, id: string, text: string) => void
  children?: React.ReactNode
}) {
  const completed = isCompleted(task.stage)
  const titleClass =
    (heading
      ? '-mx-1.5 w-fit max-w-full rounded-lg px-1.5 text-2xl font-semibold tracking-tight transition hover:bg-cream '
      : 'text-base ' + (completed ? '' : 'font-medium ')) +
    'break-words ' +
    (completed ? 'text-ink-faint line-through decoration-ink-faint/50' : 'text-ink')

  return (
    <div className={'flex min-w-0 flex-1 gap-3.5 ' + (heading ? 'items-start' : 'items-center')}>
      <span className={heading ? 'mt-1.5 flex' : 'flex'}>
        <StageSelect value={task.stage} onChange={(stage) => onSetStage(task.id, stage)} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <EditableText
          tag={heading ? 'h2' : 'span'}
          text={task.text}
          editable={heading}
          onCommit={(name) => onRename?.(RowKind.Task, task.id, name)}
          className={titleClass}
          inputClassName={TITLE_RENAME_CLASS}
        />
        {children}
      </div>
    </div>
  )
}
