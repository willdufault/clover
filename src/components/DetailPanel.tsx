import { useState } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { formatDue, isOverdue, isRelative } from "../due";
import type { Subtask, Task } from "../drop";
import { FIELD, ItemType, STAGE, dueClass, type Stage } from "../shared";
import { SortableRow } from "./rows";

export default function DetailPanel({
  task,
  onClose,
  onAddSubtask,
  onToggleSubtask,
  onSetStage,
  onSetDue,
  onSetPriority,
  onContextMenu,
  renameBox,
}: {
  task: Task;
  onClose: () => void;
  onAddSubtask: (text: string) => void;
  onToggleSubtask: (id: string) => void;
  onSetStage: (id: string, stage?: Stage) => void;
  onSetDue: (id: string, due?: string) => void;
  onSetPriority: (id: string, priority?: "low" | "high") => void;
  onContextMenu: (
    kind: ItemType,
    id: string,
    text: string,
  ) => (e: React.MouseEvent) => void;
  renameBox: (kind: ItemType, id: string, className: string) => React.ReactNode;
}) {
  const [subtaskText, setSubtaskText] = useState("");

  const add = () => {
    if (!subtaskText.trim()) return;
    onAddSubtask(subtaskText);
    setSubtaskText("");
  };

  const subtaskRow = (subtask: Subtask) => (
    <SortableRow
      key={subtask.id}
      id={subtask.id}
      kind={ItemType.Subtask}
      text={subtask.text}
      tag="li"
      onContextMenu={onContextMenu(ItemType.Subtask, subtask.id, subtask.text)}
      className="group flex select-none items-center gap-3 border-b border-gray-200 py-2"
    >
      <input
        type="checkbox"
        checked={subtask.done}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onChange={() => onToggleSubtask(subtask.id)}
        className="size-4 accent-blue-500"
      />
      {renameBox(
        ItemType.Subtask,
        subtask.id,
        "min-w-0 flex-1 rounded border border-blue-400 bg-white px-1 py-0.5 text-sm text-gray-800 outline-none",
      ) || (
        <span
          className={
            subtask.done ? "text-gray-400 line-through" : "text-gray-800"
          }
        >
          {subtask.text}
        </span>
      )}
    </SortableRow>
  );

  return (
    <aside className="w-72 shrink-0 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] border-l border-gray-200 bg-gray-100 p-3">
      <div className="flex items-center">
        <h2 className="font-semibold text-gray-800">{task.text}</h2>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="ml-auto rounded text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      <input
        value={subtaskText}
        onChange={(e) => setSubtaskText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        placeholder="Add a subtask and press Enter"
        className={"mt-4 " + FIELD}
      />

      <SortableContext
        items={task.subtasks}
        strategy={verticalListSortingStrategy}
      >
        <ul className="mt-4 max-h-64 w-full overflow-y-auto">
          {task.subtasks.map(subtaskRow)}
        </ul>
      </SortableContext>

      {task.subtasks.length === 0 && (
        <p className="mt-4 text-sm text-gray-400">No subtasks yet</p>
      )}

      <h3 className="mt-4 mb-1 text-xs font-medium text-gray-500">Stage</h3>
      <select
        aria-label="Stage"
        value={task.stage ?? ""}
        onChange={(e) =>
          onSetStage(task.id, (e.target.value || undefined) as Stage | undefined)
        }
        className={FIELD}
      >
        <option value="">⬜ Open</option>
        {(Object.keys(STAGE) as Stage[]).map((stage) => (
          <option key={stage} value={stage}>
            {STAGE[stage].emoji} {STAGE[stage].label}
          </option>
        ))}
      </select>
      <h3 className="mt-4 mb-1 text-xs font-medium text-gray-500">Due date</h3>
      <div className="flex items-center gap-2">
        <input
          type="date"
          aria-label="Due date"
          value={task.due ?? ""}
          onChange={(e) => onSetDue(task.id, e.target.value || undefined)}
          className={
            FIELD + (task.due && isOverdue(task.due) ? " text-red-600" : "")
          }
        />
        {task.due && (
          <button
            onClick={() => onSetDue(task.id)}
            aria-label="Remove due date"
            className="text-gray-500 hover:text-gray-800"
          >
            ×
          </button>
        )}
      </div>
      {task.due &&
        isRelative(task.due) && (
          <p className={"mt-1 " + dueClass(task.due)}>{formatDue(task.due)}</p>
        )}
      <h3 className="mt-4 mb-1 text-xs font-medium text-gray-500">Priority</h3>
      <select
        aria-label="Priority"
        value={task.priority ?? ""}
        onChange={(e) =>
          onSetPriority(
            task.id,
            (e.target.value || undefined) as "low" | "high" | undefined,
          )
        }
        className={FIELD}
      >
        <option value="low">🔵 Low</option>
        <option value="">Medium</option>
        <option value="high">🔴 High</option>
      </select>
    </aside>
  );
}
