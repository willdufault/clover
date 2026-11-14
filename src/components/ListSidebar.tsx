import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { listColor, sidebarRowClass } from '../styles'
import { RowKind, type Task, type TaskList } from '../types'
import { ALL_LIST_ID, ALL_LIST_NAME, TODAY_LIST_ID, tasksInList } from '../smartLists'
import { TaskCountBadge } from './TaskCountBadge'
import { AddInput } from './AddInput'
import { SortableRow } from './SortableRow'
import { TodayRow } from './TodayRow'
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
  return (
    <div className="flex w-64 shrink-0 flex-col bg-sprout">
    <div className="flex items-center gap-2 px-6 pt-7 pb-5">
      <span className="flex size-8 items-center justify-center rounded-xl bg-paper text-base shadow-[0_2px_8px_-3px_rgba(84,66,30,0.2)]">🍀</span>
      <span className="text-lg font-semibold tracking-tight text-ink">clover</span>
    </div>
    <nav className="flex flex-1 flex-col gap-0.5 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] px-3 pb-4">
      <TodayRow
        count={tasksInList(tasks, TODAY_LIST_ID).length}
        selected={selectedListId === TODAY_LIST_ID}
        dragOver={dragOverListId === TODAY_LIST_ID}
        onClick={() => onSelectList(TODAY_LIST_ID)}
      />
      <div
        onClick={() => onSelectList(ALL_LIST_ID)}
        className={sidebarRowClass(selectedListId === ALL_LIST_ID, false)}
      >
        <span>{ALL_LIST_NAME}</span>
        <TaskCountBadge count={tasksInList(tasks, ALL_LIST_ID).length} />
      </div>
      <hr className="mx-3 my-3 border-sprout-deep" />
      <SortableContext items={lists} strategy={verticalListSortingStrategy}>
        {lists.map((list, index) => (
          <SortableRow
            key={list.id}
            id={list.id}
            kind={RowKind.List}
            text={list.name}
            tag="div"
            onClick={() => onSelectList(list.id)}
            onContextMenu={onContextMenu(RowKind.List, list.id)}
            className={
              'border-b border-transparent ' +
              sidebarRowClass(list.id === selectedListId, list.id === dragOverListId)
            }
          >
            <span className="flex min-w-0 items-center gap-[5px]"><span className="flex w-4 shrink-0 items-center justify-center"><span className="size-3 rounded-[4px]" style={{ background: listColor(index) }} /></span><span className="truncate">{list.name}</span></span>
            <TaskCountBadge count={tasksInList(tasks, list.id).length} />
          </SortableRow>
        ))}
      </SortableContext>

      <AddInput placeholder="+ New list" onAdd={onCreateList} />
    </nav>
    </div>
  )
}
