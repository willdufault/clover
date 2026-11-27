import { useState } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faBars, faEllipsis, faPen, faXmark } from '@fortawesome/free-solid-svg-icons'
import { TITLE_RENAME_CLASS, ICON_BUTTON_CLASS, META_TEXT_CLASS } from '../styles'
import type { SortCriteria } from '../sort'
import type { Task } from '../types'
import { SMART_LIST_ICONS } from '../smartLists'
import { AddInput } from './AddInput'
import limits from '../shared/limits.json'
import { EditableText } from './EditableText'
import type { OpenContextMenu } from './ContextMenu'
import { Popover, rem } from './Popover'
import { anchorOf, type Anchor } from './Picker'
import { TaskRow } from './TaskRow'
import { SortMenu } from './SortMenu'
import { MenuOption } from './MenuOption'

function TitleIcon({ listId }: { listId: string }) {
  const icon = SMART_LIST_ICONS[listId]
  return (
    icon && (
      <span className="mr-[calc(var(--spacing-icon)-0.25rem)] flex h-10 items-center text-3xl text-clover sm:text-4xl">
        <FontAwesomeIcon icon={icon} className="text-2xl sm:text-3xl" />
      </span>
    )
  )
}

const MAIN_CLASS =
  'min-w-0 flex-1 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] px-4 pt-5 pb-10 sm:px-6 lg:px-8 lg:pt-8'

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
  dragIds,
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
  dragIds: string[]
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
  const columnClass = 'mx-auto w-full max-w-3xl ' + (wide ? 'xl:max-w-5xl' : '2xl:max-w-4xl')

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
              <MenuOption
                icon={{ icon: faPen, color: 'text-lichen' }}
                label="Rename list"
                onClick={() => {
                  closeListMenu()
                  setRenameRequest((count) => count + 1)
                }}
              />
              <MenuOption
                icon={{ icon: faTrashCan }}
                label="Delete list"
                danger
                onClick={() => {
                  closeListMenu()
                  onDeleteList(selectedListId)
                }}
              />
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
          {tasks.length > 0 && (
            <ul className="mt-1">
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  selected={selectedIds.includes(task.id)}
                  menuOpen={menuIds.includes(task.id)}
                  hidden={dragIds.includes(task.id)}
                  onSelect={(event) => onSelectTask(task.id, event)}
                  onToggleDone={() => onToggleDone(task)}
                  onContextMenu={onContextMenu}
                />
              ))}
            </ul>
          )}
        </SortableContext>

        {tasks.length === 0 && <p className="mt-8 px-2 font-serif text-lg text-moss/80 italic">No tasks yet.</p>}
      </div>
    </main>
  )
}
