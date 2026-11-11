import { useState } from 'react'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { navRowClass } from '../styles'
import { ItemKind, type Task, type TaskList } from '../types'
import { ALL_VIEW_ID, ALL_VIEW_NAME, TODAY_VIEW_ID, visibleTasks } from '../views'
import { Count } from './Count'
import { RenameInput } from './RenameInput'
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
  renderRenameInput,
}: {
  lists: TaskList[]
  tasks: Task[]
  viewId: string
  dragOverViewId: string | null
  onSelectView: (id: string) => void
  onCreateList: (name: string) => void
  onContextMenu: OpenMenu
  renderRenameInput: (kind: ItemKind, id: string, className: string) => React.ReactNode
}) {
  const [addingList, setAddingList] = useState(false)
  const [newListName, setNewListName] = useState('')

  const stopAdding = () => {
    setAddingList(false)
    setNewListName('')
  }

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
            onContextMenu={onContextMenu(ItemKind.List, list.id, list.name)}
            className={navRowClass(
              list.id === viewId,
              list.id === dragOverViewId,
            )}
          >
            {renderRenameInput(
              ItemKind.List,
              list.id,
              'w-full min-w-0 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-sm font-medium text-gray-800 outline-none',
            ) || (
              <>
                <span className="min-w-0 break-words">{list.name}</span>
                <Count count={visibleTasks(tasks, list.id).length} />
              </>
            )}
          </SortableRow>
        ))}
      </SortableContext>

      <hr className="my-1 border-gray-300" />
      {addingList ? (
        <RenameInput
          draft={newListName}
          onChange={setNewListName}
          onCommit={() => {
            onCreateList(newListName)
            stopAdding()
          }}
          onCancel={stopAdding}
          placeholder="List name…"
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        />
      ) : (
        <button
          onClick={() => setAddingList(true)}
          className="rounded-md px-3 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-200/60"
        >
          + New list
        </button>
      )}
    </nav>
  )
}
