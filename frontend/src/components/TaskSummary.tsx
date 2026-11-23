import { isCompleted } from '../stages'
import type { Stage, Task } from '../types'
import { StageSelect } from './StageSelect'

export function TaskSummary({
  task,
  onSetStage,
  children,
}: {
  task: Task
  onSetStage: (stage: Stage) => void
  children?: React.ReactNode
}) {
  const completed = isCompleted(task.stage)
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3.5">
      <span className="flex">
        <StageSelect value={task.stage} onChange={onSetStage} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={
            'text-base break-words ' +
            (completed ? 'text-ink-faint line-through decoration-ink-faint/50' : 'font-medium text-ink')
          }
        >
          {task.title}
        </span>
        {children}
      </div>
    </div>
  )
}
