import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { formatDue } from '../due'
import { PRIORITY } from '../labels'
import { dueClass } from '../styles'
import { ItemType, type Stage, type Task } from '../types'
import { AddInput } from './AddInput'
import type { OpenMenu } from './ContextMenu'
import { SortableRow } from './SortableRow'
import { StageSelect } from './StageSelect'

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
      <StageSelect
        value={task.stage}
        onChange={(stage) => onSetStage(task.id, stage)}
        className="bg-transparent"
      />
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

      <AddInput placeholder="Add a task and press Enter" onAdd={onAdd} />

      <SortableContext items={tasks} strategy={verticalListSortingStrategy}>
        <ul className="mt-4 w-full">{tasks.map(taskRow)}</ul>
      </SortableContext>

      {tasks.length === 0 && (
        <p className="mt-4 text-sm text-gray-400">No tasks yet</p>
      )}
    </main>
  )
}
