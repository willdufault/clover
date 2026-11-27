import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEllipsis, faListCheck, faSun } from '@fortawesome/free-solid-svg-icons'
import { formatDueDate, isOverdue } from '../dates'
import { dueIcon, isCompleted, priorityLabel, stageLabel } from '../labels'
import { ICON_BUTTON_CLASS, ICON_SLOT_CLASS, META_TEXT_CLASS, doneTextClass, rowStateClass } from '../styles'
import { RowKind, type Task } from '../types'
import { MENU_WIDTH, type OpenContextMenu } from './ContextMenu'
import { ignoreRowEvents } from './ignoreRowEvents'
import { rem } from './Popover'
import { SortableRow } from './SortableRow'

const metaItems = (task: Task) => {
  const items = []
  if (task.addedToToday)
    items.push(
      <span key="today" title="In Today" className="flex items-center gap-icon">
        <FontAwesomeIcon icon={faSun} className="text-clover" />
        Today
      </span>,
    )
  if (task.due) {
    const icon = dueIcon(task.due)
    items.push(
      <span key="due" className={'flex items-center gap-icon' + (isOverdue(task.due) ? ' text-rosehip' : '')}>
        <FontAwesomeIcon icon={icon.icon} title={icon.text} className={icon.color} />
        {formatDueDate(task.due)}
      </span>,
    )
  }
  if (task.priority !== 'medium') {
    const priority = priorityLabel(task.priority)
    items.push(
      <span key="priority" title={`${priority.text} priority`} className="flex items-center gap-icon">
        <FontAwesomeIcon icon={priority.icon} className={priority.color} />
        {priority.text}
      </span>,
    )
  }
  if (task.steps.length > 0)
    items.push(
      <span key="steps" className="flex items-center gap-icon">
        <FontAwesomeIcon icon={faListCheck} className="text-lichen" />
        {task.steps.filter((step) => step.completed).length}/{task.steps.length}
      </span>,
    )
  return items
}

const actionsOpacity = (menuOpen: boolean, selected: boolean) => {
  if (menuOpen) return 'opacity-100'
  return selected ? 'opacity-40' : 'opacity-0'
}

export function TaskRow({
  task,
  selected,
  menuOpen,
  hidden,
  onSelect,
  onToggleDone,
  onContextMenu,
}: {
  task: Task
  selected: boolean
  menuOpen: boolean
  hidden: boolean
  onSelect: (event: React.MouseEvent) => void
  onToggleDone: () => void
  onContextMenu: OpenContextMenu
}) {
  const meta = metaItems(task)
  const stage = stageLabel(task.stage)
  return (
    <SortableRow
      id={task.id}
      kind={RowKind.Task}
      tag="li"
      onClick={onSelect}
      onContextMenu={onContextMenu(RowKind.Task, task.id)}
      hidden={hidden}
      selected={selected}
      className={
        'group relative flex cursor-pointer select-none items-start gap-icon rounded-lg py-2.5 pr-2 pl-2 transition motion-reduce:transition-none pointer-fine:pr-10 ' +
        rowStateClass(selected, menuOpen)
      }
    >
      <button
        {...ignoreRowEvents}
        aria-label={task.stage === 'done' ? 'Mark open' : 'Mark done'}
        title={stage.text}
        onClick={(event) => {
          event.stopPropagation()
          onToggleDone()
        }}
        className={
          'touch-hit h-6 cursor-pointer rounded-full text-lg transition active:scale-90 ' +
          ICON_SLOT_CLASS +
          ' ' +
          stage.color
        }
      >
        <FontAwesomeIcon icon={stage.icon} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={'max-w-2xl text-base break-words ' + doneTextClass(isCompleted(task.stage))}>
          {task.title}
        </span>
        {meta.length > 0 && (
          <p className={'mt-0.5 flex flex-wrap items-center gap-x-3.5 gap-y-0.5 ' + META_TEXT_CLASS}>{meta}</p>
        )}
      </div>
      <button
        {...ignoreRowEvents}
        aria-label="Task actions"
        aria-haspopup="menu"
        onClick={(event) => {
          event.stopPropagation()
          const button = event.currentTarget.getBoundingClientRect()
          const row = event.currentTarget.parentElement?.getBoundingClientRect() ?? button
          onContextMenu(
            RowKind.Task,
            task.id,
          )({
            clientX: button.right - rem(MENU_WIDTH),
            clientY: row.bottom + 4,
            above: row.top - 4,
          })
        }}
        className={
          ICON_BUTTON_CLASS +
          ' absolute top-2 right-1.5 size-8 text-lichen group-hover:opacity-100 focus-visible:opacity-100 group-focus-visible:opacity-100 pointer-coarse:hidden ' +
          actionsOpacity(menuOpen, selected)
        }
      >
        <FontAwesomeIcon icon={faEllipsis} />
      </button>
    </SortableRow>
  )
}
