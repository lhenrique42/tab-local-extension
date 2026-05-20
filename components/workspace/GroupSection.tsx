import { useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  SavedCollection,
  SavedGroup,
  SavedTab,
} from "../../lib/storage/schema";
import { CHROME_GROUP_COLOR_HEX } from "../../lib/constants/colors";
import { Icon, ConfirmDialog } from "../shared";
import { CollectionCard } from "./CollectionCard";

interface GroupSectionProps {
  group: SavedGroup;
  collections: SavedCollection[];
  defaultOpen?: boolean;
  onNewCollection: (groupId: string) => void;
  onRenameGroup: (id: string, name: string) => void;
  onDeleteGroup: (id: string) => void;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onAddTab: (collectionId: string, url: string) => void;
  onRemoveTab: (collectionId: string, tabId: string) => void;
  onDuplicateTab: (collectionId: string, tabId: string) => void;
  onReorderCollections: (groupId: string, newIds: string[]) => void;
  onReorderTabs: (collectionId: string, newTabs: SavedTab[]) => void;
  onRestore: (collectionId: string) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  SortableCollectionCard — wraps CollectionCard with useSortable      */
/* ------------------------------------------------------------------ */

interface SortableCollectionCardProps {
  collection: SavedCollection;
  isDragging?: boolean;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAddTab: (collectionId: string, url: string) => void;
  onRemoveTab: (collectionId: string, tabId: string) => void;
  onDuplicateTab: (collectionId: string, tabId: string) => void;
  onReorderTabs: (collectionId: string, newTabs: SavedTab[]) => void;
  onRestore: (collectionId: string) => Promise<void>;
}

function SortableCollectionCard({
  collection,
  isDragging = false,
  ...cardProps
}: SortableCollectionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: collection.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="tl-sortable-card-wrapper">
      <button
        className="tl-drag-handle tl-card-drag-handle"
        aria-label={`Drag ${collection.name}`}
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <Icon name="grip" size={12} aria-hidden />
      </button>
      <CollectionCard collection={collection} {...cardProps} />
    </div>
  );
}

/** Renders a named group section header with a collapsible collection card grid. */
export function GroupSection({
  group,
  collections,
  defaultOpen = true,
  onNewCollection,
  onRenameGroup,
  onDeleteGroup,
  onRenameCollection,
  onDeleteCollection,
  onAddTab,
  onRemoveTab,
  onDuplicateTab,
  onReorderCollections,
  onReorderTabs,
  onRestore,
}: GroupSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleCollectionDragStart(event: DragStartEvent) {
    setActiveCollectionId(String(event.active.id));
  }

  function handleCollectionDragEnd(event: DragEndEvent) {
    setActiveCollectionId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = collections.map((c) => c.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorderCollections(group.id, arrayMove(ids, oldIndex, newIndex));
  }

  const dotColor =
    group.color && group.color in CHROME_GROUP_COLOR_HEX
      ? CHROME_GROUP_COLOR_HEX[
          group.color as keyof typeof CHROME_GROUP_COLOR_HEX
        ]
      : "var(--fg-tertiary)";

  const collectionCount = collections.length;
  const collectionLabel = `${collectionCount} ${collectionCount === 1 ? "collection" : "collections"}`;

  function startRename() {
    setRenameValue(group.name);
    setRenaming(true);
  }

  function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed) onRenameGroup(group.id, trimmed);
    setRenaming(false);
  }

  function handleRenameKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    }
    if (e.key === "Escape") {
      setRenaming(false);
    }
  }

  return (
    <>
      <section className={`tl-group${open ? "" : " is-collapsed"}`}>
        <header
          className="tl-group-head"
          onClick={() => !renaming && setOpen((v) => !v)}
          aria-expanded={open}
        >
          <button
            className="tl-group-chevron"
            aria-label={open ? "Collapse group" : "Expand group"}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            <Icon name="chevron-down" size={14} />
          </button>

          <span
            className="tl-group-dot"
            style={{ background: dotColor }}
            aria-hidden="true"
          />

          {renaming ? (
            <input
              className="tl-group-name tl-inline-input"
              value={renameValue}
              autoFocus
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKey}
              aria-label="Rename group"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h2
              className="tl-group-name"
              onDoubleClick={(e) => {
                e.stopPropagation();
                startRename();
              }}
            >
              {group.name}
            </h2>
          )}

          <span className="tl-group-count" aria-label={collectionLabel}>
            {collectionLabel}
          </span>

          <button
            className="tl-btn tl-btn-sm tl-btn-ghost"
            aria-label="Rename group"
            title="Rename group"
            onClick={(e) => {
              e.stopPropagation();
              startRename();
            }}
          >
            <Icon name="save" size={12} />
          </button>

          <button
            className="tl-btn tl-btn-sm tl-btn-ghost"
            aria-label="New collection"
            title="New collection in this group"
            onClick={(e) => {
              e.stopPropagation();
              onNewCollection(group.id);
            }}
          >
            <Icon name="plus" size={12} />
          </button>

          <button
            className="tl-btn tl-btn-sm tl-btn-ghost"
            aria-label="Delete group"
            title="Delete group"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
          >
            <Icon name="trash" size={12} />
          </button>
        </header>

        {open &&
          (collections.length === 0 ? (
            <p className="tl-group-empty">No collections in this group yet.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleCollectionDragStart}
              onDragEnd={handleCollectionDragEnd}
              accessibility={{
                screenReaderInstructions: {
                  draggable:
                    "To reorder, press Space or Enter to start dragging. Use arrow keys to move. Press Space or Enter to drop.",
                },
              }}
            >
              <SortableContext
                items={collections.map((c) => c.id)}
                strategy={rectSortingStrategy}
              >
                <div className="tl-grid">
                  {collections.map((c) => (
                    <SortableCollectionCard
                      key={c.id}
                      collection={c}
                      isDragging={activeCollectionId === c.id}
                      onRename={onRenameCollection}
                      onDelete={onDeleteCollection}
                      onAddTab={onAddTab}
                      onRemoveTab={onRemoveTab}
                      onDuplicateTab={onDuplicateTab}
                      onReorderTabs={onReorderTabs}
                      onRestore={onRestore}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeCollectionId
                  ? (() => {
                      const activeCollection = collections.find(
                        (c) => c.id === activeCollectionId,
                      );
                      return activeCollection ? (
                        <div className="tl-drag-overlay-card">
                          <span className="tl-collection-title">
                            {activeCollection.name}
                          </span>
                        </div>
                      ) : null;
                    })()
                  : null}
              </DragOverlay>
            </DndContext>
          ))}
      </section>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete group"
          message={`Delete "${group.name}" and all ${collectionCount} collection${collectionCount !== 1 ? "s" : ""}? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => {
            setConfirmDelete(false);
            onDeleteGroup(group.id);
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
