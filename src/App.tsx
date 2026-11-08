import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDue, isOverdue, nextMonday, today, tomorrow } from "./due";
import {
  applyDrop,
  moveSubtaskAfterLastOpen,
  type Subtask,
  type Task,
  type TaskList,
} from "./drop";

type Stage = NonNullable<Task["stage"]>;

const STAGE: Record<Stage, string> = {
  progress: "⚡ In progress",
  waiting: "⏳ Waiting",
  done: "✅ Done",
  // U+FE0F forces emoji rendering; the native dropdown list otherwise shows a plain x
  cancelled: "❌\uFE0F Cancelled",
};

const seedLists: TaskList[] = [
  {
    id: "groceries",
    name: "Groceries",
    tasks: [
      {
        id: "g1",
        text: "Milk",
        subtasks: [
          { id: "g1a", text: "2% lactose free", done: false },
        ],
      },
      { id: "g2", text: "Eggs", subtasks: [] },
    ],
  },
  {
    id: "work",
    name: "Work",
    tasks: [
      { id: "w1", text: "Reply to emails", subtasks: [] },
      { id: "w2", text: "Update docs", subtasks: [] },
      { id: "w3", text: "Review PR", subtasks: [] },
    ],
  },
  { id: "home", name: "Home", tasks: [] },
];

// Row that can be dragged among its SortableContext siblings.
function SortableRow({
  id,
  tag,
  className,
  onClick,
  onContextMenu,
  children,
}: {
  id: string;
  tag: "li" | "div";
  className?: string;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const Tag = tag;
  return (
    <Tag
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={isDragging ? "opacity-60 shadow-lg " + className : className}
      {...attributes}
      {...listeners}
    >
      {children}
    </Tag>
  );
}

// In-place rename box: Enter commits, Escape or blur cancels.
function RenameInput({
  draft,
  onChange,
  onCommit,
  onCancel,
  className,
}: {
  draft: string;
  onChange: (draft: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  className: string;
}) {
  return (
    <input
      autoFocus
      onFocus={(e) => e.target.select()}
      value={draft}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit();
        if (e.key === "Escape") onCancel();
      }}
      onBlur={onCancel}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={className}
    />
  );
}

export default function App() {
  const [lists, setLists] = useState(seedLists);
  const [selectedId, setSelectedId] = useState(seedLists[0].id);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{
    kind: "list" | "task" | "subtask";
    text: string;
  } | null>(null);
  const [dragOverListId, setDragOverListId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    kind: "list" | "task" | "subtask";
    id: string;
    text: string;
    due?: string;
  } | null>(null);
  const [renaming, setRenaming] = useState<{
    kind: "list" | "task" | "subtask";
    id: string;
    draft: string;
  } | null>(null);
  const [text, setText] = useState("");
  const [subtaskText, setSubtaskText] = useState("");
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");

  const selectedList = lists.find((list) => list.id === selectedId);
  const selectedItem = selectedList?.tasks.find(
    (task) => task.id === selectedItemId,
  );

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  const updateTasks = (listId: string, fn: (tasks: Task[]) => Task[]) => {
    setLists(
      lists.map((list) =>
        list.id === listId ? { ...list, tasks: fn(list.tasks) } : list,
      ),
    );
  };

  // Apply f to the subtasks of the task with id.
  const updateSubtasks = (taskId: string, f: (subtasks: Subtask[]) => Subtask[]) =>
    updateTasks(selectedId, (tasks) =>
      tasks.map((task) =>
        task.id === taskId ? { ...task, subtasks: f(task.subtasks) } : task,
      ),
    );

  const addTask = () => {
    if (!text.trim()) return;
    updateTasks(selectedId, (tasks) => [
      { id: crypto.randomUUID(), text, subtasks: [] },
      ...tasks,
    ]);
    setText("");
  };

  const addSubtask = () => {
    if (!subtaskText.trim() || !selectedItem) return;
    updateSubtasks(selectedItem.id, (subtasks) => [
      { id: crypto.randomUUID(), text: subtaskText, done: false },
      ...subtasks,
    ]);
    setSubtaskText("");
  };

  const deleteTask = (id: string) =>
    updateTasks(selectedId, (tasks) => tasks.filter((task) => task.id !== id));

  const renameTask = (id: string, text: string) =>
    updateTasks(selectedId, (tasks) =>
      tasks.map((task) => (task.id === id ? { ...task, text } : task)),
    );

  const toggleSubtask = (id: string) =>
    updateSubtasks(selectedItemId!, (subtasks) =>
      moveSubtaskAfterLastOpen(
        subtasks.map((subtask) =>
          subtask.id === id ? { ...subtask, done: !subtask.done } : subtask,
        ),
        id,
      ),
    );

  const deleteSubtask = (id: string) =>
    updateSubtasks(selectedItemId!, (subtasks) =>
      subtasks.filter((subtask) => subtask.id !== id),
    );

  const renameSubtask = (id: string, text: string) =>
    updateSubtasks(selectedItemId!, (subtasks) =>
      subtasks.map((subtask) =>
        subtask.id === id ? { ...subtask, text } : subtask,
      ),
    );

  const dueClass = (due: string) =>
    "text-xs " + (isOverdue(due) ? "text-red-600" : "text-gray-500");

  const setDue = (id: string, due?: string) =>
    updateTasks(selectedId, (tasks) =>
      tasks.map((task) => (task.id === id ? { ...task, due } : task)),
    );

  const setPriority = (id: string, priority?: "low" | "high") =>
    updateTasks(selectedId, (tasks) =>
      tasks.map((task) => (task.id === id ? { ...task, priority } : task)),
    );

  const setStage = (id: string, stage?: Stage) =>
    updateTasks(selectedId, (tasks) =>
      tasks.map((task) => (task.id === id ? { ...task, stage } : task)),
    );

  const taskRow = (task: Task) => (
    <SortableRow
      key={task.id}
      id={task.id}
      tag="li"
      onClick={() => setSelectedItemId(task.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({
          x: e.clientX,
          y: e.clientY,
          kind: "task",
          id: task.id,
          text: task.text,
          due: task.due,
        });
      }}
      className="group flex select-none items-center gap-3 border-b border-gray-100 py-2"
    >
      <select
        aria-label="Task stage"
        value={task.stage ?? ""}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) =>
          setStage(task.id, (e.target.value || undefined) as Stage | undefined)
        }
        className="bg-transparent"
      >
        <option value="">⬜</option>
        {(Object.keys(STAGE) as Stage[]).map((stage) => (
          <option key={stage} value={stage}>
            {STAGE[stage].split(" ")[0]}
          </option>
        ))}
      </select>
     {renaming?.kind === "task" && renaming.id === task.id ? (
        <RenameInput
          draft={renaming.draft}
          onChange={(draft) => setRenaming({ ...renaming, draft })}
          onCommit={commitRename}
          onCancel={() => setRenaming(null)}
          className="min-w-0 flex-1 rounded border border-blue-400 bg-white px-1 py-0.5 text-sm text-gray-800 outline-none"
        />
      ) : (
        <div className="flex flex-col">
          <span
            className={
              task.stage === "done" || task.stage === "cancelled"
                ? "text-gray-400 line-through"
                : "text-gray-800"
            }
          >
            {task.text}
          </span>
          {(task.due || task.priority) && (
            <div className="flex gap-3">
              {task.due && (
                <span className={dueClass(task.due)}>
                  Due {formatDue(task.due)}
                </span>
              )}
              {task.priority && (
                <span
                  className={
                    "text-xs " +
                    (task.priority === "high"
                      ? "text-red-600"
                      : "text-blue-600")
                  }
                >
                  {task.priority === "high"
                    ? "🔴 High priority"
                    : "🔵 Low priority"}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </SortableRow>
  );

  const subtaskRow = (subtask: Subtask) => (
    <SortableRow
      key={subtask.id}
      id={subtask.id}
      tag="li"
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({
          x: e.clientX,
          y: e.clientY,
          kind: "subtask",
          id: subtask.id,
          text: subtask.text,
        });
      }}
      className="group flex select-none items-center gap-3 border-b border-gray-200 py-2"
    >
      <input
        type="checkbox"
        checked={subtask.done}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onChange={() => toggleSubtask(subtask.id)}
        className="size-4 accent-blue-500"
      />
      {renaming?.kind === "subtask" && renaming.id === subtask.id ? (
        <RenameInput
          draft={renaming.draft}
          onChange={(draft) => setRenaming({ ...renaming, draft })}
          onCommit={commitRename}
          onCancel={() => setRenaming(null)}
          className="min-w-0 flex-1 rounded border border-blue-400 bg-white px-1 py-0.5 text-sm text-gray-800 outline-none"
        />
      ) : (
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

  // Apply the in-progress rename (no-op on empty draft = cancel).
  const commitRename = () => {
    if (!renaming) return;
    const { kind, id, draft } = renaming;
    const name = draft.trim();
    setRenaming(null);
    if (!name) return;
    if (kind === "list") {
      setLists(
        lists.map((list) => (list.id === id ? { ...list, name } : list)),
      );
    } else if (kind === "task") {
      renameTask(id, name);
    } else {
      renameSubtask(id, name);
    }
  };

  const createList = () => {
    const name = newListName.trim();
    setAddingList(false);
    setNewListName("");
    if (!name) return;
    const newList = { id: crypto.randomUUID(), name, tasks: [] };
    setLists([...lists, newList]);
    setSelectedId(newList.id);
    setSelectedItemId(null);
  };

  const deleteList = (id: string) => {
    const remaining = lists.filter((list) => list.id !== id);
    const index = lists.findIndex((list) => list.id === id);
    setLists(remaining);
    if (id === selectedId) {
      setSelectedItemId(null);
      if (remaining.length > 0) {
        setSelectedId((remaining[index - 1] ?? remaining[0]).id);
      }
    }
  };

  // Remember what is being dragged so DragOverlay can render a floating clone.
  const onDragStart = ({ active }: DragStartEvent) => {
    for (const list of lists) {
      if (list.id === String(active.id)) {
        setDrag({ kind: "list", text: list.name });
        return;
      }
      for (const task of list.tasks) {
        if (task.id === String(active.id)) {
          setDrag({ kind: "task", text: task.text });
          return;
        }
        const sub = task.subtasks.find((sub) => sub.id === String(active.id));
        if (sub) {
          setDrag({ kind: "subtask", text: sub.text });
          return;
        }
      }
    }
  };

  // Highlight the sidebar list row a task is hovering over.
  const onDragOver = ({ over }: DragOverEvent) => {
    const listIds = lists.map((list) => list.id);
    setDragOverListId(
      over && drag?.kind === "task" && listIds.includes(String(over.id))
        ? String(over.id)
        : null,
    );
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDrag(null);
    setDragOverListId(null);
    if (!over) return;
    const overId = String(over.id);
    const next = applyDrop(lists, {
      selectedId,
      selectedItemId,
      dragKind: drag?.kind,
      activeId: String(active.id),
      overId,
    });
    if (next === lists) return;
    setLists(next);
    if (drag?.kind === "task" && lists.some((list) => list.id === overId))
      setSelectedItemId(null);
  };

  return (
    <DndContext
      sensors={useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
      )}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDrag(null);
        setDragOverListId(null);
      }}
    >
      <div className="flex h-screen overflow-hidden flex-col font-sans">
        {" "}
        <header className="flex h-12 shrink-0 items-center bg-gray-200 px-4">
          <span className="font-semibold text-gray-800">todo</span>
        </header>
        <div className="flex flex-1 min-h-0">
          <nav className="flex w-64 shrink-0 flex-col gap-1 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] border-r border-gray-200 bg-gray-100 p-3">
            <SortableContext
              items={lists}
              strategy={verticalListSortingStrategy}
            >
              {lists.map((list) => (
                <SortableRow
                  key={list.id}
                  id={list.id}
                  tag="div"
                  onClick={() => {
                    setSelectedId(list.id);
                    setSelectedItemId(null);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({
                      x: e.clientX,
                      y: e.clientY,
                      kind: "list",
                      id: list.id,
                      text: list.name,
                    });
                  }}
                  className={
                    list.id === dragOverListId
                      ? "group flex select-none items-center rounded-md bg-blue-100 outline-2 outline-blue-300 px-3 py-1.5 text-left text-sm text-gray-800"
                      : list.id === selectedId
                        ? "group flex select-none items-center rounded-md bg-gray-200 px-3 py-1.5 text-left text-sm font-medium text-gray-800"
                        : "group flex select-none items-center rounded-md px-3 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-200/60"
                  }
                >
                  {renaming?.kind === "list" && renaming.id === list.id ? (
                    <RenameInput
                      draft={renaming.draft}
                      onChange={(draft) => setRenaming({ ...renaming, draft })}
                      onCommit={commitRename}
                      onCancel={() => setRenaming(null)}
                      className="w-full min-w-0 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-sm font-medium text-gray-800 outline-none"
                    />
                  ) : (
                    <span className="truncate">{list.name}</span>
                  )}
                </SortableRow>
              ))}
            </SortableContext>

            {addingList ? (
              <input
                autoFocus
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createList();
                  if (e.key === "Escape") {
                    setAddingList(false);
                    setNewListName("");
                  }
                }}
                onBlur={() => {
                  setAddingList(false);
                  setNewListName("");
                }}
                placeholder="List name…"
                className="mt-auto w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500"
              />
            ) : (
              <button
                onClick={() => setAddingList(true)}
                className="mt-auto rounded-md px-3 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-200/60"
              >
                + New list
              </button>
            )}
          </nav>

          <main className="flex-1 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] p-6">
            {!selectedList ? (
              <p className="text-sm text-gray-400">
                No lists yet — create one on the left
              </p>
            ) : (
              <>
                <h1 className="font-semibold text-gray-800">
                  {selectedList.name}
                </h1>

                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask()}
                  placeholder="Add a task and press Enter"
                  className="mt-4 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
                />

                <SortableContext
                  items={selectedList.tasks}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="mt-4 w-full">
                    {selectedList.tasks.map(taskRow)}
                  </ul>
                </SortableContext>

                {selectedList.tasks.length === 0 && (
                  <p className="mt-4 text-sm text-gray-400">No tasks yet</p>
                )}
              </>
            )}
          </main>

          {selectedItem && (
            <aside className="w-72 shrink-0 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable] border-l border-gray-200 bg-gray-100 p-3">
              <div className="flex items-center">
                <h2 className="font-semibold text-gray-800">
                  {selectedItem.text}
                </h2>
                <button
                  onClick={() => setSelectedItemId(null)}
                  className="ml-auto rounded text-gray-400 hover:text-gray-600"
                  aria-label="Close panel"
                >
                  ✕
                </button>
              </div>

              <input
                value={subtaskText}
                onChange={(e) => setSubtaskText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSubtask()}
                placeholder="Add a subtask and press Enter"
                className="mt-4 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
              />

              <SortableContext
                items={selectedItem.subtasks}
                strategy={verticalListSortingStrategy}
              >
                <ul className="mt-4 max-h-64 w-full overflow-y-auto">
                  {selectedItem.subtasks.map(subtaskRow)}
                </ul>
              </SortableContext>

              {selectedItem.subtasks.length === 0 && (
                <p className="mt-4 text-sm text-gray-400">No subtasks yet</p>
              )}

              <h3 className="mt-4 mb-1 text-xs font-medium text-gray-500">
                Stage
              </h3>
              <select
                aria-label="Stage"
                value={selectedItem.stage ?? ""}
                onChange={(e) =>
                  setStage(
                    selectedItem.id,
                    (e.target.value || undefined) as Stage | undefined,
                  )
                }
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
              >
                <option value="">Open</option>
                <option value="progress">In progress</option>
                <option value="waiting">Waiting</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <h3 className="mt-4 mb-1 text-xs font-medium text-gray-500">
                Due date
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label="Due date"
                  value={selectedItem.due ?? ""}
                  onChange={(e) =>
                    setDue(selectedItem.id, e.target.value || undefined)
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
                />
                {selectedItem.due && (
                  <button
                    onClick={() => setDue(selectedItem.id)}
                    aria-label="Remove due date"
                    className="text-gray-500 hover:text-gray-800"
                  >
                    ×
                  </button>
                )}
              </div>
              <h3 className="mt-4 mb-1 text-xs font-medium text-gray-500">
                Priority
              </h3>
              <select
                aria-label="Priority"
                value={selectedItem.priority ?? ""}
                onChange={(e) =>
                  setPriority(
                    selectedItem.id,
                    (e.target.value || undefined) as "low" | "high" | undefined,
                  )
                }
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
              >
                <option value="low">Low</option>
                <option value="">Medium</option>
                <option value="high">High</option>
              </select>
            </aside>
          )}
        </div>
      </div>
      <DragOverlay>
        {drag && (
          <div className="cursor-default select-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-lg">
            {drag.text}
          </div>
        )}
      </DragOverlay>

      {menu && (
        <>
          {/* Invisible backdrop to catch clicks outside the menu. */}
          <div
            className="fixed inset-0"
            onClick={() => setMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu(null);
            }}
          />
          <div
            className="fixed z-50 max-h-64 w-44 overflow-y-auto rounded-md border border-gray-300 bg-white py-1 text-sm shadow-lg"
            style={{ left: Math.min(menu.x, window.innerWidth - 176), top: Math.min(menu.y, window.innerHeight - 256) }}
          >
            <button
              onClick={() => {
                setRenaming({ kind: menu.kind, id: menu.id, draft: menu.text });
                setMenu(null);
              }}
              className="block w-full cursor-default px-3 py-1.5 text-left text-gray-700 hover:bg-gray-100"
            >
              Rename
            </button>
            <button
              onClick={() => {
                if (menu.kind === "list") deleteList(menu.id);
                else if (menu.kind === "task") deleteTask(menu.id);
                else deleteSubtask(menu.id);
                setMenu(null);
              }}
              className="block w-full cursor-default px-3 py-1.5 text-left text-red-600 hover:bg-gray-100"
            >
              Delete
            </button>
            {menu.kind === "task" && (
              <>
                <hr className="my-1 border-gray-200" />
                {[
                  ["Due today", today()],
                  ["Due tomorrow", tomorrow()],
                  ["Due next Monday", nextMonday()],
                ].map(([label, date]) => (
                  <button
                    key={label}
                    onClick={() => {
                      setDue(menu.id, date);
                      setMenu(null);
                    }}
                    className="block w-full cursor-default px-3 py-1.5 text-left text-gray-700 hover:bg-gray-100"
                  >
                    {label}
                  </button>
                ))}
                {menu.due && (
                  <button
                    onClick={() => {
                      setDue(menu.id);
                      setMenu(null);
                    }}
                    className="block w-full cursor-default px-3 py-1.5 text-left text-gray-700 hover:bg-gray-100"
                  >
                    Remove due date
                  </button>
                )}
                <hr className="my-1 border-gray-200" />
                {(
                  [
                    ["Set low priority", "low"],
                    ["Set medium priority", undefined],
                    ["Set high priority", "high"],
                  ] as const
                ).map(([label, p]) => (
                  <button
                    key={label}
                    onClick={() => {
                      setPriority(menu.id, p);
                      setMenu(null);
                    }}
                    className="block w-full cursor-default px-3 py-1.5 text-left text-gray-700 hover:bg-gray-100"
                  >
                    {label}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </DndContext>
  );
}
