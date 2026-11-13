import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { sidebarRowClass } from '../styles'
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
    <nav className="flex w-64 shrink-0 flex-col gap-1 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] border-r border-gray-200 bg-gray-100 p-3">
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
      <hr className="my-1 border-gray-300" />
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
            className={
              'border-b border-gray-200 ' +
              sidebarRowClass(list.id === selectedListId, list.id === dragOverListId)
            }
          >
            <span className="min-w-0 truncate"><span>⚌ </span>{list.name}</span>
            <TaskCountBadge count={tasksInList(tasks, list.id).length} />
          </SortableRow>
        ))}
      </SortableContext>

      <AddInput placeholder="+ New list" onAdd={onCreateList} />
    </nav>
  )
}
