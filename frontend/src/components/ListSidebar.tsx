import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClover, faXmark } from '@fortawesome/free-solid-svg-icons'
import { SAFE_AREA_CLASS, ICON_BUTTON_CLASS, sidebarRowClass } from '../styles'
import { isCompleted } from '../labels'
import { RowKind, type Task, type TaskList } from '../types'
import { ALL_LIST_ID, SMART_LIST_ICONS, SMART_LIST_NAMES, TODAY_LIST_ID, tasksInList } from '../smartLists'
import { logout } from '../api'
import { TaskCountBadge } from './TaskCountBadge'
import { IconSlot } from './IconSlot'
import { AddInput } from './AddInput'
import limits from '../shared/limits.json'
import { SortableRow } from './SortableRow'
import { useModalFocus } from '../useModalFocus'
import type { OpenContextMenu } from './ContextMenu'

const openCount = (tasks: Task[], listId: string) =>
  tasksInList(tasks, listId).filter((task) => !isCompleted(task.stage)).length

export default function ListSidebar({
  lists,
  tasks,
  selectedListId,
  dragOverListId,
  menuIds,
  drawerOpen,
  inert,
  onClose,
  onSelectList,
  onCreateList,
  onContextMenu,
}: {
  lists: TaskList[]
  tasks: Task[]
  selectedListId: string
  dragOverListId: string | null
  menuIds: string[]
  drawerOpen: boolean
  inert: boolean
  onClose: () => void
  onSelectList: (id: string) => void
  onCreateList: (name: string) => void
  onContextMenu: OpenContextMenu
}) {
  const { setNodeRef: setTodayRef } = useDroppable({ id: TODAY_LIST_ID })
  const closeRef = useModalFocus<HTMLButtonElement>(drawerOpen)
  return (
    <>
      {drawerOpen && <div onClick={onClose} className="fixed inset-0 z-40 bg-moss/30 lg:hidden" />}
      <div
        inert={inert}
        role={drawerOpen ? 'dialog' : undefined}
        aria-modal={drawerOpen || undefined}
        aria-label="Lists"
        className={
          'fixed inset-y-0 left-0 z-40 flex w-72 max-w-5/6 shrink-0 flex-col border-r border-fieldstone bg-parchment shadow-md lg:visible lg:static lg:z-auto lg:w-64 lg:p-0 lg:shadow-none 2xl:w-72 ' +
          SAFE_AREA_CLASS +
          (drawerOpen ? ' fade-in' : ' invisible')
        }
      >
        <div className="flex items-center justify-between overflow-hidden [scrollbar-gutter:stable] px-3 pt-8 pb-4">
          <div className="flex items-center gap-icon px-3 py-1 font-serif text-2xl font-medium text-moss">
            <FontAwesomeIcon icon={faClover} className="text-xl text-clover" />
            Clover
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close lists"
            className={ICON_BUTTON_CLASS + ' size-9 text-lg text-lichen lg:hidden'}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] px-3 pb-4">
          <div
            ref={setTodayRef}
            onClick={() => onSelectList(TODAY_LIST_ID)}
            className={sidebarRowClass(selectedListId === TODAY_LIST_ID, dragOverListId === TODAY_LIST_ID)}
          >
            <span className="flex items-center gap-icon">
              <IconSlot icon={SMART_LIST_ICONS[TODAY_LIST_ID]} color="text-clover" />
              {SMART_LIST_NAMES[TODAY_LIST_ID]}
            </span>
            <TaskCountBadge count={openCount(tasks, TODAY_LIST_ID)} />
          </div>
          <div
            onClick={() => onSelectList(ALL_LIST_ID)}
            className={sidebarRowClass(selectedListId === ALL_LIST_ID, false)}
          >
            <span className="flex items-center gap-icon">
              <IconSlot icon={SMART_LIST_ICONS[ALL_LIST_ID]} color="text-clover" />
              {SMART_LIST_NAMES[ALL_LIST_ID]}
            </span>
            <TaskCountBadge count={openCount(tasks, ALL_LIST_ID)} />
          </div>
          <hr className="mx-3 my-3 border-fieldstone" />
          <SortableContext items={lists} strategy={verticalListSortingStrategy}>
            {lists.map((list) => (
              <SortableRow
                key={list.id}
                id={list.id}
                kind={RowKind.List}
                tag="div"
                onClick={() => onSelectList(list.id)}
                onContextMenu={onContextMenu(RowKind.List, list.id)}
                className={sidebarRowClass(
                  list.id === selectedListId,
                  list.id === dragOverListId,
                  menuIds.includes(list.id),
                )}
              >
                <span className="line-clamp-1 min-w-0 break-words">{list.name}</span>
                <TaskCountBadge count={openCount(tasks, list.id)} />
              </SortableRow>
            ))}
          </SortableContext>

          <AddInput
            placeholder="Add a list"
            maxLength={limits.listNameMax}
            onAdd={onCreateList}
            className="mt-2 shrink-0"
          />
        </nav>
        <button
          onClick={() => void logout()}
          className="touch-hit mx-4 mb-2 w-fit cursor-pointer rounded-md px-2 py-2.5 text-base text-moss/80 transition hover:text-moss pointer-fine:mb-5 pointer-fine:py-1"
        >
          Log out
        </button>
      </div>
    </>
  )
}
