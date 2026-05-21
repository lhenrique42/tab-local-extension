import { useState } from "react";
import type { CSSProperties, HTMLAttributes, KeyboardEvent } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
    SortableContext,
    rectSortingStrategy,
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
    dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
    activeCollectionId?: string | null;
    isCollectionDropTarget?: boolean;
    onNewCollection: (groupId: string) => void;
    onRenameGroup: (id: string, name: string) => void;
    onDeleteGroup: (id: string) => void;
    onRenameCollection: (id: string, name: string) => void;
    onDeleteCollection: (id: string) => void;
    onAddTab: (
        collectionId: string,
        url: string,
        title?: string,
        faviconUrl?: string | null,
    ) => void;
    onRemoveTab: (collectionId: string, tabId: string) => void;
    onDuplicateCollection?: (collectionId: string) => void;
    onEditTab?: (
        collectionId: string,
        tabId: string,
        newUrl: string,
        newTitle: string,
    ) => void;
    onReorderTabs: (collectionId: string, newTabs: SavedTab[]) => void;
    onRestore: (collectionId: string) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  SortableCollectionCard — wraps CollectionCard with useSortable      */
/* ------------------------------------------------------------------ */

interface SortableCollectionCardProps {
    collection: SavedCollection;
    groupName: string;
    groupColor: string;
    isDragging?: boolean;
    onRename: (id: string, name: string) => void;
    onDelete: (id: string) => void;
    onAddTab: (
        collectionId: string,
        url: string,
        title?: string,
        faviconUrl?: string | null,
    ) => void;
    onRemoveTab: (collectionId: string, tabId: string) => void;
    onDuplicate?: (id: string) => void;
    onEditTab?: (
        collectionId: string,
        tabId: string,
        newUrl: string,
        newTitle: string,
    ) => void;
    onReorderTabs: (collectionId: string, newTabs: SavedTab[]) => void;
    onRestore: (collectionId: string) => Promise<void>;
}

function SortableCollectionCard({
    collection,
    groupName,
    groupColor,
    isDragging = false,
    onEditTab,
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
        <div
            ref={setNodeRef}
            style={style}
            className="tl-sortable-card-wrapper"
        >
            <button
                className="tl-drag-handle tl-card-drag-handle"
                aria-label={`Drag ${collection.name}`}
                title="Drag to reorder"
                {...attributes}
                {...listeners}
            >
                <Icon name="grip" size={12} aria-hidden />
            </button>
            <CollectionCard
                collection={collection}
                groupName={groupName}
                groupColor={groupColor}
                onEditTab={onEditTab}
                {...cardProps}
            />
        </div>
    );
}

/** Renders a named group section header with a collapsible collection card grid. */
export function GroupSection({
    group,
    collections,
    defaultOpen = true,
    dragHandleProps,
    activeCollectionId,
    isCollectionDropTarget = false,
    onNewCollection,
    onRenameGroup,
    onDeleteGroup,
    onRenameCollection,
    onDeleteCollection,
    onAddTab,
    onRemoveTab,
    onDuplicateCollection,
    onEditTab,
    onReorderTabs,
    onRestore,
}: GroupSectionProps) {
    const [open, setOpen] = useState(defaultOpen);
    const [renaming, setRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(false);

    const { setNodeRef: setDropRef } = useDroppable({
        id: `group-droppable-${group.id}`,
        data: { type: "group-droppable", groupId: group.id },
    });

    const dotColor =
        group.color && group.color in CHROME_GROUP_COLOR_HEX
            ? CHROME_GROUP_COLOR_HEX[
                  group.color as keyof typeof CHROME_GROUP_COLOR_HEX
              ]
            : "var(--fg-tertiary)";

    const collectionCount = collections.length;

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
            <section
                className={`tl-group${open ? "" : " is-collapsed"}${isCollectionDropTarget ? " is-collection-drop-target" : ""}`}
                style={{ "--group-color": dotColor } as CSSProperties}
            >
                <header
                    className="tl-group-head"
                    onClick={() => !renaming && setOpen((v) => !v)}
                >
                    {dragHandleProps && (
                        <button
                            className="tl-drag-handle tl-group-drag-handle"
                            aria-label="Drag to reorder group"
                            title="Drag to reorder"
                            onClick={(e) => e.stopPropagation()}
                            {...dragHandleProps}
                        >
                            <Icon name="grip" size={12} />
                        </button>
                    )}
                    <button
                        className="tl-group-chevron"
                        aria-label={open ? "Collapse group" : "Expand group"}
                        aria-expanded={open}
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

                    <span
                        className="tl-group-count"
                        aria-label={`${collectionCount} collection${collectionCount !== 1 ? "s" : ""}`}
                    >
                        {collectionCount}
                    </span>

                    <div className="tl-group-actions">
                        <button
                            className="tl-btn tl-btn-sm tl-btn-ghost"
                            aria-label="Rename group"
                            title="Rename group"
                            onClick={(e) => {
                                e.stopPropagation();
                                startRename();
                            }}
                        >
                            <Icon name="pencil" size={12} />
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
                    </div>
                </header>

                {open &&
                    (collections.length === 0 ? (
                        <p
                            className="tl-group-empty"
                            ref={setDropRef}
                        >
                            No collections in this group yet.
                        </p>
                    ) : (
                        <SortableContext
                            id={group.id}
                            items={collections.map((c) => c.id)}
                            strategy={rectSortingStrategy}
                        >
                            <div className="tl-grid" ref={setDropRef}>
                                {collections.map((c) => (
                                    <SortableCollectionCard
                                        key={c.id}
                                        collection={c}
                                        groupName={group.name}
                                        groupColor={dotColor}
                                        isDragging={
                                            activeCollectionId === c.id
                                        }
                                        onRename={onRenameCollection}
                                        onDelete={onDeleteCollection}
                                        onAddTab={onAddTab}
                                        onRemoveTab={onRemoveTab}
                                        onDuplicate={onDuplicateCollection}
                                        onEditTab={onEditTab}
                                        onReorderTabs={onReorderTabs}
                                        onRestore={onRestore}
                                    />
                                ))}
                            </div>
                        </SortableContext>
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
