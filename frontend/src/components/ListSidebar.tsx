import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SAFE_AREA_CLASS, X_BUTTON_CLASS, sidebarRowClass } from '../styles'
import { RowKind, type Task, type TaskList } from '../types'
import { ALL_LIST_ID, SMART_LIST_NAMES, TODAY_LIST_ID, tasksInList } from '../smartLists'
import { logout } from '../api'
import { TaskCountBadge } from './TaskCountBadge'
import { AddInput } from './AddInput'
import limits from '../../../shared/limits.json'
import { SortableRow } from './SortableRow'
import { useModalFocus } from '../useModalFocus'
import type { OpenContextMenu } from './ContextMenu'

export default function ListSidebar({
  lists,
  tasks,
  selectedListId,
  dragOverListId,
  open,
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
  open: boolean
  inert: boolean
  onClose: () => void
  onSelectList: (id: string) => void
  onCreateList: (name: string) => void
  onContextMenu: OpenContextMenu
}) {
  const { setNodeRef: setTodayRef } = useDroppable({ id: TODAY_LIST_ID })
  const closeRef = useModalFocus<HTMLButtonElement>(open)
  return (
    <>
      {open && <div onClick={onClose} className="fixed inset-0 z-40 bg-ink/30 lg:hidden" />}
      <div
        inert={inert}
        role={open ? 'dialog' : undefined}
        aria-modal={open || undefined}
        aria-label="Lists"
        className={
          'fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] shrink-0 flex-col bg-sprout shadow-pop duration-200 lg:visible lg:static lg:z-auto lg:w-64 lg:translate-x-0 lg:p-0 lg:shadow-none 2xl:w-72 ' +
          SAFE_AREA_CLASS +
          (open ? ' transition-[translate]' : ' invisible -translate-x-full transition-[translate,visibility]')
        }
      >
        <div className="flex items-center justify-between overflow-hidden [scrollbar-gutter:stable] px-3 pt-6 pb-4">
          <div className="px-3 py-2 text-lg font-semibold tracking-tight text-ink">🍀 clover</div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close lists"
            className={X_BUTTON_CLASS + ' text-ink-soft lg:hidden'}
          >
            ✕
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] px-3 pb-4">
          <div
            ref={setTodayRef}
            onClick={() => onSelectList(TODAY_LIST_ID)}
            className={sidebarRowClass(selectedListId === TODAY_LIST_ID, dragOverListId === TODAY_LIST_ID)}
          >
            <span>{SMART_LIST_NAMES[TODAY_LIST_ID]}</span>
            <TaskCountBadge count={tasksInList(tasks, TODAY_LIST_ID).length} />
          </div>
          <div
            onClick={() => onSelectList(ALL_LIST_ID)}
            className={sidebarRowClass(selectedListId === ALL_LIST_ID, false)}
          >
            <span>{SMART_LIST_NAMES[ALL_LIST_ID]}</span>
            <TaskCountBadge count={tasksInList(tasks, ALL_LIST_ID).length} />
          </div>
          <hr className="mx-3 my-3 border-sprout-deep" />
          <SortableContext items={lists} strategy={verticalListSortingStrategy}>
            {lists.map((list) => (
              <SortableRow
                key={list.id}
                id={list.id}
                kind={RowKind.List}
                text={list.name}
                tag="div"
                onClick={() => onSelectList(list.id)}
                onContextMenu={onContextMenu(RowKind.List, list.id)}
                className={sidebarRowClass(list.id === selectedListId, list.id === dragOverListId)}
              >
                <span className="min-w-0 truncate">{list.name}</span>
                <TaskCountBadge count={tasksInList(tasks, list.id).length} />
              </SortableRow>
            ))}
          </SortableContext>

          <AddInput
            placeholder="+ New list"
            maxLength={limits.listNameMax}
            onAdd={onCreateList}
            className="mt-4 shrink-0"
          />
        </nav>
        <button
          onClick={() => void logout()}
          className="mx-6 mb-1 w-fit py-3 text-sm text-ink-soft transition hover:text-ink pointer-fine:mb-4 pointer-fine:py-0"
        >
          Log out
        </button>
      </div>
    </>
  )
}
