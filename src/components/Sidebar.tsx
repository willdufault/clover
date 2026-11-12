import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { navRowClass } from '../styles'
import { ItemKind, type Task, type TaskList } from '../types'
import { ALL_VIEW_ID, ALL_VIEW_NAME, TODAY_VIEW_ID, visibleTasks } from '../views'
import { Count } from './Count'
import { AddInput } from './AddInput'
import { SortableRow } from './SortableRow'
import { TodayRow } from './TodayRow'
import type { OpenMenu } from './ContextMenu'

export default function Sidebar({
  lists,
  tasks,
  viewId,
  dragOverViewId,
  onSelectView,
  onCreateList,
  onContextMenu,
}: {
  lists: TaskList[]
  tasks: Task[]
  viewId: string
  dragOverViewId: string | null
  onSelectView: (id: string) => void
  onCreateList: (name: string) => void
  onContextMenu: OpenMenu
}) {
  return (
    <nav className="flex w-64 shrink-0 flex-col gap-1 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] border-r border-gray-200 bg-gray-100 p-3">
      <TodayRow
        count={visibleTasks(tasks, TODAY_VIEW_ID).length}
        selected={viewId === TODAY_VIEW_ID}
        dragOver={dragOverViewId === TODAY_VIEW_ID}
        onClick={() => onSelectView(TODAY_VIEW_ID)}
      />
      <div
        onClick={() => onSelectView(ALL_VIEW_ID)}
        className={navRowClass(viewId === ALL_VIEW_ID, false)}
      >
        <span>{ALL_VIEW_NAME}</span>
        <Count count={visibleTasks(tasks, ALL_VIEW_ID).length} />
      </div>
      <hr className="my-1 border-gray-300" />
      <SortableContext items={lists} strategy={verticalListSortingStrategy}>
        {lists.map((list) => (
          <SortableRow
            key={list.id}
            id={list.id}
            kind={ItemKind.List}
            text={list.name}
            tag="div"
            onClick={() => onSelectView(list.id)}
            onContextMenu={onContextMenu(ItemKind.List, list.id)}
            className={
              'border-b border-gray-200 ' +
              navRowClass(list.id === viewId, list.id === dragOverViewId)
            }
          >
            <span className="min-w-0 truncate">{list.name}</span>
            <Count count={visibleTasks(tasks, list.id).length} />
          </SortableRow>
        ))}
      </SortableContext>

      <AddInput placeholder="+ New list" onAdd={onCreateList} />
    </nav>
  )
}
