import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, type CSSProperties, type HTMLAttributes } from "react";
import type { SavedTab } from "../../lib/storage/schema";
import { Icon } from "../shared";

interface FaviconProps {
  tab: SavedTab;
  size: number;
}

/** Renders the tab favicon image, falling back to a colored letter tile. */
function Favicon({ tab, size }: FaviconProps) {
  const hostname = (() => {
    try {
      return new URL(tab.url).hostname;
    } catch {
      return "";
    }
  })();
  const letter = (tab.title[0] ?? hostname[0] ?? "?").toUpperCase();

  if (tab.faviconUrl) {
    return (
      <>
        <img
          src={tab.faviconUrl}
          alt=""
          width={size}
          height={size}
          style={{ borderRadius: 3, display: "inline-block", flexShrink: 0 }}
          onError={(e) => {
            const img = e.currentTarget;
            img.style.display = "none";
            const fallback = img.nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.display = "inline-flex";
          }}
        />
        <span
          className="tl-favicon-letter"
          style={{
            width: size,
            height: size,
            fontSize: Math.max(8, size * 0.65),
            display: "none",
          }}
          aria-hidden="true"
        >
          {letter}
        </span>
      </>
    );
  }

  return (
    <span
      className="tl-favicon-letter"
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.65) }}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  TabRowContent — shared between SortableTabRow and DragOverlay       */
/* ------------------------------------------------------------------ */

interface TabRowContentProps {
  tab: SavedTab;
  onRemove?: (tabId: string) => void;
  onDuplicate?: (tabId: string) => void;
  isDragging?: boolean;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
}

function TabRowContent({ tab, onRemove, onDuplicate, isDragging, dragHandleProps }: TabRowContentProps) {
  const hasActions = Boolean(onRemove ?? onDuplicate);
  return (
    <div
      className={`tl-tab-row is-dense${isDragging ? " is-dragging" : ""}`}
      role="listitem"
      aria-roledescription="sortable"
    >
      <button
        className="tl-drag-handle"
        aria-label={`Drag ${tab.title}`}
        title="Drag to reorder"
        {...dragHandleProps}
      >
        <Icon name="grip" size={12} aria-hidden />
      </button>
      <span className="tl-tab-row-bar" aria-hidden="true" />
      <Favicon tab={tab} size={14} />
      <span className="tl-tab-row-title" title={tab.title}>
        {tab.title}
      </span>
      <span className="tl-tab-row-url" title={tab.url}>
        {(() => {
          try {
            return new URL(tab.url).hostname;
          } catch {
            return tab.url;
          }
        })()}
      </span>
      {hasActions && (
        <div className="tl-tab-row-actions">
          {onDuplicate && (
            <button
              className="tl-btn tl-btn-xs tl-btn-ghost"
              aria-label={`Duplicate tab ${tab.title}`}
              title="Duplicate"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(tab.id);
              }}
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="4" y="4" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M1 10V2a1 1 0 0 1 1-1h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
          {onRemove && (
            <button
              className="tl-btn tl-btn-xs tl-btn-ghost tl-btn-danger-ghost"
              aria-label={`Remove tab ${tab.title}`}
              title="Remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(tab.id);
              }}
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 4h10M5 4V2h4v2M6 7v4M8 7v4M3 4l1 8h6l1-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SortableTabRow — wraps a tab row with useSortable                   */
/* ------------------------------------------------------------------ */

interface SortableTabRowProps {
  tab: SavedTab;
  onRemove?: (tabId: string) => void;
  onDuplicate?: (tabId: string) => void;
}

function SortableTabRow({ tab, onRemove, onDuplicate }: SortableTabRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TabRowContent
        tab={tab}
        onRemove={onRemove}
        onDuplicate={onDuplicate}
        dragHandleProps={{ ...attributes, ...listeners } as HTMLAttributes<HTMLButtonElement>}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TabList                                                              */
/* ------------------------------------------------------------------ */

interface TabListProps {
  tabs: SavedTab[];
  onRemove?: (tabId: string) => void;
  onDuplicate?: (tabId: string) => void;
  onReorder?: (newOrder: SavedTab[]) => void;
}

/** Interactive, sortable list of saved tab rows inside an expanded CollectionCard. */
export function TabList({ tabs, onRemove, onDuplicate, onReorder }: TabListProps) {
  const [activeTab, setActiveTab] = useState<SavedTab | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    const tab = tabs.find((t) => t.id === event.active.id);
    setActiveTab(tab ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTab(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tabs.findIndex((t) => t.id === active.id);
    const newIndex = tabs.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder?.(arrayMove(tabs, oldIndex, newIndex));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: "To reorder, press Space or Enter to start dragging. Use arrow keys to move. Press Space or Enter to drop.",
        },
      }}
    >
      <SortableContext items={tabs.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div role="list" aria-label="Saved tabs">
          {tabs.map((tab) => (
            <SortableTabRow
              key={tab.id}
              tab={tab}
              onRemove={onRemove}
              onDuplicate={onDuplicate}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeTab ? (
          <TabRowContent tab={activeTab} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
