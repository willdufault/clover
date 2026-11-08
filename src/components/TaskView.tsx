import { useState } from 'react'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { formatDue } from '../due'
import type { Task } from '../drop'
import { FIELD, ItemType, PRIORITY, STAGE, dueClass, type Stage } from '../shared'
import type { OpenMenu } from './ContextMenu'
import { SortableRow } from './rows'

export default function TaskView({
  name,
  tasks,
  onAdd,
  onSelectTask,
  onSetStage,
  onContextMenu,
  renameBox,
}: {
  name: string | undefined
  tasks: Task[]
  onAdd: (text: string) => void
  onSelectTask: (id: string) => void
  onSetStage: (id: string, stage?: Stage) => void
  onContextMenu: OpenMenu
  renameBox: (kind: ItemType, id: string, className: string) => React.ReactNode
}) {
  const [text, setText] = useState('')

  const add = () => {
    if (!text.trim()) return
    onAdd(text)
    setText('')
  }

  const taskRow = (task: Task) => (
    <SortableRow
      key={task.id}
      id={task.id}
      kind={ItemType.Task}
      text={task.text}
      tag="li"
      onClick={() => onSelectTask(task.id)}
      onContextMenu={onContextMenu(ItemType.Task, task.id, task.text, task.due)}
      className="group flex select-none items-center gap-3 border-b border-gray-100 py-2"
    >
      <select
        value={task.stage ?? ''}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) =>
          onSetStage(task.id, (e.target.value || undefined) as Stage | undefined)
        }
        className="bg-transparent"
      >
        <option value="">⬜</option>
        {(Object.keys(STAGE) as Stage[]).map((stage) => (
          <option key={stage} value={stage}>
            {STAGE[stage].emoji}
          </option>
        ))}
      </select>
      {renameBox(
        ItemType.Task,
        task.id,
        'min-w-0 flex-1 rounded border border-blue-400 bg-white px-1 py-0.5 text-sm text-gray-800 outline-none',
      ) || (
        <div className="flex flex-col">
          <span
            className={
              task.stage === 'done' || task.stage === 'cancelled'
                ? 'text-gray-400 line-through'
                : 'text-gray-800'
            }
          >
            {task.text}
          </span>
          {(task.subtasks.length > 0 || task.due || task.priority) && (
            <div className="flex gap-3">
              {task.subtasks.length > 0 && (
                <span className="text-xs text-gray-500">
                  {task.subtasks.filter((s) => s.done).length}/
                  {task.subtasks.length}
                </span>
              )}
              {task.due && (
                <span className={dueClass(task.due)}>
                  Due {formatDue(task.due)}
                </span>
              )}
              {task.priority && (
                <span className="text-xs text-gray-500">
                  {PRIORITY[task.priority].emoji}{' '}
                  {PRIORITY[task.priority].label} priority
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </SortableRow>
  )

  return (
    <main className="flex-1 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] p-6">
      <h1 className="font-semibold text-gray-800">{name}</h1>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
        placeholder="Add a task and press Enter"
        className={'mt-4 ' + FIELD}
      />

      <SortableContext items={tasks} strategy={verticalListSortingStrategy}>
        <ul className="mt-4 w-full">{tasks.map(taskRow)}</ul>
      </SortableContext>

      {tasks.length === 0 && (
        <p className="mt-4 text-sm text-gray-400">No tasks yet</p>
      )}
    </main>
  )
}
