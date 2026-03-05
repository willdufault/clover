import type { TaskInfo } from "../types/task"

type TaskModalProps = {
  taskInfo: TaskInfo
  onClose: () => void
}

export default function TaskModal({ taskInfo, onClose }: TaskModalProps) {
  const { task, stage } = taskInfo
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl leading-none"
        >
          ×
        </button>
        <h2 className="text-lg font-semibold mb-3">{task.title}</h2>
        <div className="text-sm text-gray-500">
          Stage: <span className="font-medium text-gray-700">{stage}</span>
        </div>
      </div>
    </div>
  )
}
