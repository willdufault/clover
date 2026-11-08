import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ALL, TODAY, visibleTasks, type Task, type TaskList } from '../drop'
import { ItemType, navRowClass } from '../shared'
import { Count, RenameInput, SortableRow } from './rows'

// Sidebar Today row: drop target only.
function TodayRow({
  selected,
  dragOver,
  count,
  onClick,
}: {
  count: number
  selected: boolean
  dragOver: boolean
  onClick: () => void
}) {
  const { setNodeRef } = useDroppable({ id: TODAY })
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={navRowClass(selected, dragOver)}
    >
      <span>Today</span>
      <Count n={count} />
    </div>
  )
}

export default function Sidebar({
  lists,
  tasks,
  viewId,
  dragOverListId,
  onSelect,
  onCreateList,
  onContextMenu,
  renameBox,
}: {
  lists: TaskList[]
  tasks: Task[]
  viewId: string
  dragOverListId: string | null
  onSelect: (id: string) => void
  onCreateList: (name: string) => void
  onContextMenu: (
    kind: ItemType,
    id: string,
    text: string,
  ) => (e: React.MouseEvent) => void
  renameBox: (kind: ItemType, id: string, className: string) => React.ReactNode
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
        count={visibleTasks(tasks, TODAY).length}
        selected={viewId === TODAY}
        dragOver={dragOverListId === TODAY}
        onClick={() => onSelect(TODAY)}
      />
      <div
        onClick={() => onSelect(ALL)}
        className={navRowClass(viewId === ALL, false)}
      >
        <span>All</span>
        <Count n={visibleTasks(tasks, ALL).length} />
      </div>
      <hr className="my-1 border-gray-300" />
      <SortableContext items={lists} strategy={verticalListSortingStrategy}>
        {lists.map((list) => (
          <SortableRow
            key={list.id}
            id={list.id}
            kind={ItemType.List}
            text={list.name}
            tag="div"
            onClick={() => onSelect(list.id)}
            onContextMenu={onContextMenu(ItemType.List, list.id, list.name)}
            className={navRowClass(
              list.id === viewId,
              list.id === dragOverListId,
            )}
          >
            {renameBox(
              ItemType.List,
              list.id,
              'w-full min-w-0 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-sm font-medium text-gray-800 outline-none',
            ) || (
              <>
                <span className="truncate">{list.name}</span>
                <Count n={visibleTasks(tasks, list.id).length} />
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
