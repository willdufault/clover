import { useState } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faBars, faEllipsis, faListCheck, faPen, faSun, faXmark } from '@fortawesome/free-solid-svg-icons'
import { formatDueDate, isOverdue } from '../dates'
import { dueIcon, isCompleted, priorityLabel, stageLabel } from '../labels'
import {
  TITLE_RENAME_CLASS,
  ICON_BUTTON_CLASS,
  ICON_SLOT_CLASS,
  MENU_ITEM_CLASS,
  META_TEXT_CLASS,
  rowStateClass,
} from '../styles'
import type { SortCriteria } from '../sort'
import { RowKind, type Task } from '../types'
import { SMART_LIST_ICONS } from '../smartLists'
import { AddInput } from './AddInput'
import limits from '../shared/limits.json'
import { EditableText } from './EditableText'
import { MENU_WIDTH, type OpenContextMenu } from './ContextMenu'
import { ignoreRowEvents } from './ignoreRowEvents'
import { Popover, rem } from './Popover'
import { anchorOf, type Anchor } from './Picker'
import { SortableRow } from './SortableRow'
import { SortMenu } from './SortMenu'

const metaItems = (task: Task) => {
  const items = []
  if (task.addedToToday)
    items.push(
      <span key="today" title="In Today" className="flex items-center gap-1.5">
        <FontAwesomeIcon icon={faSun} className="text-clover" />
        Today
      </span>,
    )
  if (task.due) {
    const icon = dueIcon(task.due)
    items.push(
      <span key="due" className={'flex items-center gap-1.5' + (isOverdue(task.due) ? ' text-rosehip' : '')}>
        <FontAwesomeIcon icon={icon.icon} title={icon.text} className={icon.color} />
        {formatDueDate(task.due)}
      </span>,
    )
  }
  if (task.priority !== 'medium') {
    const priority = priorityLabel(task.priority)
    items.push(
      <span key="priority" title={`${priority.text} priority`} className="flex items-center gap-1.5">
        <FontAwesomeIcon icon={priority.icon} className={priority.color} />
        {priority.text}
      </span>,
    )
  }
  if (task.steps.length > 0)
    items.push(
      <span key="steps" className="flex items-center gap-1.5">
        <FontAwesomeIcon icon={faListCheck} className="text-lichen" />
        {task.steps.filter((step) => step.completed).length}/{task.steps.length}
      </span>,
    )
  return items
}

function TitleIcon({ listId }: { listId: string }) {
  const icon = SMART_LIST_ICONS[listId]
  return (
    icon && (
      <span className="mr-1.5 flex h-10 items-center text-2xl text-clover sm:text-3xl">
        <FontAwesomeIcon icon={icon} />
      </span>
    )
  )
}

const MAIN_CLASS =
  'min-w-0 flex-1 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] px-4 pt-5 pb-10 sm:px-6 lg:px-8 lg:pt-8'

const actionsOpacity = (menuOpen: boolean, selected: boolean) => {
  if (menuOpen) return 'opacity-100'
  return selected ? 'opacity-40' : 'opacity-0'
}

function Progress({
  tasks,
  selectedCount,
  onClearSelection,
}: {
  tasks: Task[]
  selectedCount: number
  onClearSelection: () => void
}) {
  const doneCount = tasks.filter((task) => task.stage === 'done').length
  const countedTotal = tasks.filter((task) => task.stage !== 'cancelled').length
  return (
    <div className={'mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-2 ' + META_TEXT_CLASS}>
      <span className="text-base lining-nums tabular-nums">
        {doneCount} of {countedTotal} done
      </span>
      <span className="h-0.5 min-w-16 flex-1 bg-fieldstone">
        <span
          className="block h-full bg-clover"
          style={{ width: `${(doneCount / Math.max(countedTotal, 1)) * 100}%` }}
        />
      </span>
      {selectedCount > 1 && (
        <span className="flex items-center gap-1 rounded-full bg-selection py-0.5 pr-0.5 pl-3 text-moss">
          {selectedCount} selected
          <button
            onClick={onClearSelection}
            aria-label="Clear selection"
            className={ICON_BUTTON_CLASS + ' size-6 text-xs text-moss/80'}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </span>
      )}
    </div>
  )
}

export default function TaskPane({
  selectedListId,
  listName,
  renamable,
  tasks,
  selectedIds,
  menuIds,
  sort,
  onAddTask,
  onSort,
  onSelectTask,
  onClearSelection,
  onToggleDone,
  onContextMenu,
  onRenameList,
  onDeleteList,
  onOpenLists,
  inert,
  wide,
}: {
  selectedListId: string
  listName: string | undefined
  renamable: boolean
  tasks: Task[]
  selectedIds: string[]
  menuIds: string[]
  sort: SortCriteria | null
  onAddTask: (text: string) => void
  onSort: (criteria: SortCriteria | null) => void
  onSelectTask: (id: string, event: React.MouseEvent) => void
  onClearSelection: () => void
  onToggleDone: (task: Task) => void
  onContextMenu: OpenContextMenu
  onRenameList: (id: string, text: string) => void
  onDeleteList: (id: string) => void
  onOpenLists: () => void
  inert: boolean
  wide: boolean
}) {
  const [listMenu, setListMenu] = useState<Anchor | null>(null)
  const [renameRequest, setRenameRequest] = useState(0)
  const closeListMenu = () => setListMenu(null)
  const columnClass = 'w-full max-w-3xl ' + (wide ? 'xl:max-w-5xl' : '2xl:max-w-4xl')

  const taskRow = (task: Task) => {
    const meta = metaItems(task)
    const stage = stageLabel(task.stage)
    return (
      <SortableRow
        key={task.id}
        id={task.id}
        kind={RowKind.Task}
        tag="li"
        onClick={(event) => onSelectTask(task.id, event)}
        onContextMenu={onContextMenu(RowKind.Task, task.id)}
        className={
          'group relative flex cursor-pointer select-none items-start gap-3 rounded-lg py-2.5 pr-2 pl-2 transition motion-reduce:transition-none pointer-fine:pr-10 ' +
          rowStateClass(selectedIds.includes(task.id), menuIds.includes(task.id))
        }
      >
        <button
          {...ignoreRowEvents}
          aria-label={task.stage === 'done' ? 'Mark open' : 'Mark done'}
          title={stage.text}
          onClick={(event) => {
            event.stopPropagation()
            onToggleDone(task)
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
          <span
            className={
              'max-w-2xl text-base break-words ' +
              (isCompleted(task.stage) ? 'text-moss/75 line-through decoration-moss/40' : 'text-moss')
            }
          >
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
            actionsOpacity(menuIds.includes(task.id), selectedIds.includes(task.id))
          }
        >
          <FontAwesomeIcon icon={faEllipsis} />
        </button>
      </SortableRow>
    )
  }

  return (
    <main inert={inert} className={MAIN_CLASS}>
      <div className={columnClass}>
        <div className="flex items-start gap-1 pl-2">
          <button
            onClick={onOpenLists}
            aria-label="Open lists"
            className={ICON_BUTTON_CLASS + ' -ml-2 size-10 text-lg text-lichen lg:hidden'}
          >
            <FontAwesomeIcon icon={faBars} />
          </button>
          <TitleIcon listId={selectedListId} />
          <EditableText
            key={selectedListId}
            editRequest={renameRequest}
            tag="h1"
            text={listName ?? ''}
            maxLength={limits.listNameMax}
            editable={renamable}
            onCommit={(name) => onRenameList(selectedListId, name)}
            className={
              '-mx-1.5 w-fit min-w-0 max-w-full break-words rounded-md px-1.5 font-serif text-3xl/10 font-medium text-moss sm:text-4xl/10' +
              (renamable ? ' transition hover:bg-moss/5' : '')
            }
            inputClassName={TITLE_RENAME_CLASS + ' text-3xl sm:text-4xl'}
          />
          {renamable && (
            <button
              aria-label="List actions"
              aria-haspopup="menu"
              aria-expanded={!!listMenu}
              onClick={(event) => setListMenu(anchorOf(event))}
              className={ICON_BUTTON_CLASS + ' size-10 text-lg text-lichen'}
            >
              <FontAwesomeIcon icon={faEllipsis} />
            </button>
          )}
          {listMenu && (
            <Popover
              x={listMenu.rect.left}
              y={listMenu.rect.bottom + 4}
              width={rem(12)}
              title={listName}
              focusFirst={listMenu.keyboard}
              onClose={closeListMenu}
            >
              <button
                role="menuitem"
                onClick={() => {
                  closeListMenu()
                  setTimeout(() => setRenameRequest((count) => count + 1))
                }}
                className={MENU_ITEM_CLASS}
              >
                <span className={ICON_SLOT_CLASS + ' text-lichen'}>
                  <FontAwesomeIcon icon={faPen} />
                </span>
                Rename list
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  closeListMenu()
                  onDeleteList(selectedListId)
                }}
                className={MENU_ITEM_CLASS + ' text-rosehip!'}
              >
                <span className={ICON_SLOT_CLASS}>
                  <FontAwesomeIcon icon={faTrashCan} />
                </span>
                Delete list
              </button>
            </Popover>
          )}
          {tasks.length > 0 && (
            <div className="mt-1 ml-auto">
              <SortMenu sort={sort} onSort={onSort} />
            </div>
          )}
        </div>
        {tasks.length > 0 && (
          <Progress tasks={tasks} selectedCount={selectedIds.length} onClearSelection={onClearSelection} />
        )}

        <AddInput placeholder="Add a task" maxLength={limits.titleMax} onAdd={onAddTask} className="mt-4" />

        <SortableContext items={tasks} strategy={verticalListSortingStrategy} disabled={{ droppable: !!sort }}>
          {tasks.length > 0 && <ul className="mt-1">{tasks.map(taskRow)}</ul>}
        </SortableContext>

        {tasks.length === 0 && <p className="mt-8 px-2 font-serif text-lg text-moss/80 italic">No tasks yet.</p>}
      </div>
    </main>
  )
}
