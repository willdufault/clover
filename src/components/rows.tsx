import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ItemType } from "../shared";

export function Count({ n }: { n: number }) {
  return n > 0 ? <span className="text-xs text-gray-500">{n}</span> : null;
}

// Row that can be dragged among its SortableContext siblings.
export function SortableRow({
  id,
  kind,
  text,
  tag,
  className,
  onClick,
  onContextMenu,
  children,
}: {
  id: string;
  kind: ItemType;
  text: string;
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
  } = useSortable({ id, data: { kind, text } });
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
export function RenameInput({
  draft,
  onChange,
  onCommit,
  onCancel,
  className,
  placeholder,
}: {
  draft: string;
  onChange: (draft: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  className: string;
  placeholder?: string;
}) {
  return (
    <input
      placeholder={placeholder}
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
