import React, { memo } from "react";
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
import {
    useState,
    useRef,
    type CSSProperties,
    type HTMLAttributes,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { SavedTab } from "../../lib/storage/schema";
import { Icon } from "../shared";

const VIRTUALIZE_THRESHOLD = 50;
const ROW_HEIGHT_PX = 33;
const VIRTUAL_CONTAINER_HEIGHT = 400;

interface FaviconProps {
    tab: SavedTab;
    size: number;
}

const LETTER_COLORS = [
    "#4A90E2",
    "#E89A4A",
    "#5CB87E",
    "#E25C5C",
    "#9B6BE2",
    "#4DBDBD",
    "#F5C242",
    "#E26AA5",
];

function getLetterColor(char: string): string {
    return LETTER_COLORS[char.charCodeAt(0) % LETTER_COLORS.length];
}

/** Renders the tab favicon image, falling back to a colored letter tile. */
export function Favicon({ tab, size }: FaviconProps) {
    const hostname = (() => {
        try {
            return new URL(tab.url).hostname;
        } catch {
            return "";
        }
    })();
    const letter = (tab.title[0] ?? hostname[0] ?? "?").toUpperCase();
    const letterBg = getLetterColor(letter);
    // Prefer saved faviconUrl; fall back to Google S2 service for any http/https URL
    const imgSrc =
        tab.faviconUrl ??
        (hostname
            ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=${size * 2}`
            : null);

    if (imgSrc) {
        return (
            <>
                <img
                    src={imgSrc}
                    alt=""
                    width={size}
                    height={size}
                    style={{
                        borderRadius: 3,
                        display: "inline-block",
                        flexShrink: 0,
                    }}
                    onError={(e) => {
                        const img = e.currentTarget;
                        img.style.display = "none";
                        const fallback =
                            img.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = "inline-flex";
                    }}
                />
                <span
                    className="tl-favicon-letter"
                    style={{
                        width: size,
                        height: size,
                        fontSize: Math.max(8, size * 0.65),
                        background: letterBg,
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
            style={{
                width: size,
                height: size,
                fontSize: Math.max(8, size * 0.65),
                background: letterBg,
            }}
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
    onStartEdit?: () => void;
    isDragging?: boolean;
    dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
}

const TabRowContent = memo(function TabRowContent({
    tab,
    onRemove,
    onDuplicate,
    onStartEdit,
    isDragging,
    dragHandleProps,
}: TabRowContentProps) {
    const hasActions = Boolean(onRemove ?? onDuplicate ?? onStartEdit);
    return (
        <div
            className={`tl-tab-row is-dense${isDragging ? " is-dragging" : ""}`}
            role="listitem"
            aria-roledescription="sortable"
        >
            <button
                className="tl-drag-handle"
                aria-label="Drag to reorder"
                role="button"
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
                    {onStartEdit && (
                        <button
                            className="tl-btn tl-btn-xs tl-btn-ghost"
                            aria-label={`Edit tab ${tab.title}`}
                            title="Edit URL"
                            onClick={(e) => {
                                e.stopPropagation();
                                onStartEdit();
                            }}
                        >
                            <svg
                                width="11"
                                height="11"
                                viewBox="0 0 14 14"
                                fill="none"
                                aria-hidden="true"
                            >
                                <path
                                    d="M9.5 2.5L11.5 4.5L5 11H3V9L9.5 2.5Z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                    )}
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
                            <svg
                                width="11"
                                height="11"
                                viewBox="0 0 14 14"
                                fill="none"
                                aria-hidden="true"
                            >
                                <rect
                                    x="4"
                                    y="4"
                                    width="9"
                                    height="9"
                                    rx="1.5"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                />
                                <path
                                    d="M1 10V2a1 1 0 0 1 1-1h8"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                />
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
                            <svg
                                width="11"
                                height="11"
                                viewBox="0 0 14 14"
                                fill="none"
                                aria-hidden="true"
                            >
                                <path
                                    d="M2 4h10M5 4V2h4v2M6 7v4M8 7v4M3 4l1 8h6l1-8"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
});

/* ------------------------------------------------------------------ */
/*  SortableTabRow — wraps a tab row with useSortable                   */
/* ------------------------------------------------------------------ */

interface SortableTabRowProps {
    tab: SavedTab;
    onRemove?: (tabId: string) => void;
    onDuplicate?: (tabId: string) => void;
    onEdit?: (tabId: string, newUrl: string, newTitle: string) => void;
}

const SortableTabRow = memo(function SortableTabRow({
    tab,
    onRemove,
    onDuplicate,
    onEdit,
}: SortableTabRowProps) {
    const [editing, setEditing] = useState(false);
    const [editUrl, setEditUrl] = useState("");
    const [editTitle, setEditTitle] = useState("");
    const urlInputRef = useRef<HTMLInputElement>(null);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: tab.id });

    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    function startEdit() {
        setEditUrl(tab.url);
        setEditTitle(tab.title);
        setEditing(true);
        setTimeout(() => urlInputRef.current?.focus(), 0);
    }

    function commitEdit() {
        const trimmedUrl = editUrl.trim();
        if (trimmedUrl) {
            onEdit?.(tab.id, trimmedUrl, editTitle.trim() || trimmedUrl);
        }
        setEditing(false);
    }

    function handleEditKey(e: React.KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            commitEdit();
        }
        if (e.key === "Escape") setEditing(false);
    }

    if (editing) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="tl-tab-row-edit"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="tl-input-wrapper">
                    <input
                        ref={urlInputRef}
                        className="tl-tab-row-edit-input"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        onKeyDown={handleEditKey}
                        placeholder="https://example.com"
                    />
                    <svg
                        className="tl-input-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                </div>
                <div className="tl-input-wrapper">
                    <input
                        className="tl-tab-row-edit-input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={handleEditKey}
                        placeholder="Title"
                    />
                    <svg
                        className="tl-input-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                        <line x1="7" y1="7" x2="7.01" y2="7"></line>
                    </svg>
                </div>
                <div className="tl-tab-row-edit-actions">
                    <button
                        className="tl-btn tl-btn-xs tl-btn-primary"
                        onClick={commitEdit}
                    >
                        Save
                    </button>
                    <button
                        className="tl-btn tl-btn-xs tl-btn-ghost"
                        onClick={() => setEditing(false)}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div ref={setNodeRef} style={style}>
            <TabRowContent
                tab={tab}
                onRemove={onRemove}
                onDuplicate={onDuplicate}
                onStartEdit={onEdit ? startEdit : undefined}
                dragHandleProps={
                    {
                        ...attributes,
                        ...listeners,
                    } as HTMLAttributes<HTMLButtonElement>
                }
            />
        </div>
    );
});

/* ------------------------------------------------------------------ */
/*  StandardList — renders all tab rows (≤ VIRTUALIZE_THRESHOLD)        */
/* ------------------------------------------------------------------ */

interface InnerListProps {
    tabs: SavedTab[];
    onRemove?: (tabId: string) => void;
    onDuplicate?: (tabId: string) => void;
    onEdit?: (tabId: string, newUrl: string, newTitle: string) => void;
}

function StandardList({ tabs, onRemove, onDuplicate, onEdit }: InnerListProps) {
    return (
        <div role="list" aria-label="Saved tabs">
            {tabs.map((tab) => (
                <SortableTabRow
                    key={tab.id}
                    tab={tab}
                    onRemove={onRemove}
                    onDuplicate={onDuplicate}
                    onEdit={onEdit}
                />
            ))}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  VirtualizedList — renders only visible rows (> VIRTUALIZE_THRESHOLD) */
/* ------------------------------------------------------------------ */

function VirtualizedList({
    tabs,
    onRemove,
    onDuplicate,
    onEdit,
}: InnerListProps) {
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: tabs.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ROW_HEIGHT_PX,
        overscan: 5,
    });

    return (
        <div
            ref={parentRef}
            role="list"
            aria-label="Saved tabs"
            style={{ height: VIRTUAL_CONTAINER_HEIGHT, overflowY: "auto" }}
        >
            <div
                style={{
                    height: rowVirtualizer.getTotalSize(),
                    position: "relative",
                }}
            >
                {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                    const tab = tabs[virtualItem.index];
                    return (
                        <div
                            key={tab.id}
                            data-index={virtualItem.index}
                            ref={rowVirtualizer.measureElement}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                transform: `translateY(${virtualItem.start}px)`,
                            }}
                        >
                            <SortableTabRow
                                tab={tab}
                                onRemove={onRemove}
                                onDuplicate={onDuplicate}
                                onEdit={onEdit}
                            />
                        </div>
                    );
                })}
            </div>
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
    onEdit?: (tabId: string, newUrl: string, newTitle: string) => void;
    onReorder?: (newOrder: SavedTab[]) => void;
}

/** Interactive, sortable list of saved tab rows inside an expanded CollectionCard. */
export function TabList({
    tabs,
    onRemove,
    onDuplicate,
    onEdit,
    onReorder,
}: TabListProps) {
    const [activeTab, setActiveTab] = useState<SavedTab | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
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

    const useVirtual = tabs.length > VIRTUALIZE_THRESHOLD;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            accessibility={{
                screenReaderInstructions: {
                    draggable:
                        "To reorder, press Space or Enter to start dragging. Use arrow keys to move. Press Space or Enter to drop.",
                },
            }}
        >
            <SortableContext
                items={tabs.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
            >
                {useVirtual ? (
                    <VirtualizedList
                        tabs={tabs}
                        onRemove={onRemove}
                        onDuplicate={onDuplicate}
                        onEdit={onEdit}
                    />
                ) : (
                    <StandardList
                        tabs={tabs}
                        onRemove={onRemove}
                        onDuplicate={onDuplicate}
                        onEdit={onEdit}
                    />
                )}
            </SortableContext>
            <DragOverlay>
                {activeTab ? (
                    <TabRowContent tab={activeTab} isDragging />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
