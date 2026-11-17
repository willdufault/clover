import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { sidebarRowClass } from '../styles'
import { RowKind, type Task, type TaskList } from '../types'
import { ALL_LIST_ID, SMART_LIST_NAMES, TODAY_LIST_ID, tasksInList } from '../smartLists'
import { logout } from '../api'
import { TaskCountBadge } from './TaskCountBadge'
import { AddInput } from './AddInput'
import { LIST_NAME_MAX } from '../limits'
import { SortableRow } from './SortableRow'
import type { OpenContextMenu } from './ContextMenu'

export default function ListSidebar({
  lists,
  tasks,
  selectedListId,
  dragOverListId,
  onSelectList,
  onCreateList,
  onContextMenu,
}: {
  lists: TaskList[]
  tasks: Task[]
  selectedListId: string
  dragOverListId: string | null
  onSelectList: (id: string) => void
  onCreateList: (name: string) => void
  onContextMenu: OpenContextMenu
}) {
  const { setNodeRef: setTodayRef } = useDroppable({ id: TODAY_LIST_ID })
  return (
    <div className="flex w-64 shrink-0 flex-col bg-sprout">
      <div className="overflow-hidden [scrollbar-gutter:stable] px-3 pt-6 pb-4">
        <div className="px-3 py-2 text-lg font-semibold tracking-tight text-ink">🍀 clover</div>
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

        <AddInput placeholder="+ New list" maxLength={LIST_NAME_MAX} onAdd={onCreateList} className="mt-4" />
      </nav>
      <button onClick={logout} className="mx-6 mb-4 w-fit text-sm text-ink-soft transition hover:text-ink">
        Log out
      </button>
    </div>
  )
}
