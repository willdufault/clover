# Plan: Task Card Modal

## Context
Clicking a task card on the Kanban board should open a modal showing that task's details (title and current stage/column). The modal has an X button to close it. No new data is stored — `Task` type stays as-is; the column name is passed alongside the task when the card is clicked.

## Files to Create

### `frontend/src/components/TaskModal.tsx`
Modal overlay rendered via a portal (or inline at app root). Displays task title and stage. X button closes it.

```tsx
type TaskModalProps = {
  title: string
  stage: string
  onClose: () => void
}

export default function TaskModal({ title, stage, onClose }: TaskModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-96 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stage}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
        </div>
        <div className="p-4">
          <p className="font-semibold text-gray-900">{title}</p>
        </div>
      </div>
    </div>
  )
}
```

## Files to Modify

### `frontend/src/components/KanbanColumn.tsx`
Add `onTaskClick: (task: Task) => void` to `KanbanColumnProps`. Make each task card's `<div>` clickable (add `onClick={() => onTaskClick(task)}` and `cursor-pointer` class).

### `frontend/src/pages/KanbanPage.tsx`
- Add state: `const [selectedTask, setSelectedTask] = useState<{ task: Task; stage: string } | null>(null)`
- Pass `onTaskClick={(task) => setSelectedTask({ task, stage: col })}` to each `KanbanColumn`
- Render `<TaskModal>` when `selectedTask` is non-null, passing `title`, `stage`, and `onClose={() => setSelectedTask(null)}`

## Verification
- `npm run lint` — no errors
- `npm run build` — no type errors
- Manual: click a task card → modal opens showing title and stage; click X or backdrop → modal closes; disabled move buttons still work normally
