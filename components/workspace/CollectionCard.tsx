import React, { memo, useState, useRef, useEffect } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { SavedCollection, SavedTab } from "../../lib/storage/schema";
import { CHROME_GROUP_COLOR_HEX } from "../../lib/constants/colors";
import { EmptyState, Icon, ConfirmDialog } from "../shared";
import { TabList, Favicon } from "./TabList";

interface CollectionCardProps {
    collection: SavedCollection;
    groupName?: string;
    groupColor?: string;
    onRename: (id: string, name: string) => void;
    onDelete: (id: string) => void;
    onAddTab: (
        collectionId: string,
        url: string,
        title?: string,
        faviconUrl?: string | null,
    ) => void;
    onRemoveTab: (collectionId: string, tabId: string) => void;
    onDuplicateTab: (collectionId: string, tabId: string) => void;
    onEditTab?: (
        collectionId: string,
        tabId: string,
        newUrl: string,
        newTitle: string,
    ) => void;
    onReorderTabs: (collectionId: string, newTabs: SavedTab[]) => void;
    onRestore: (collectionId: string) => Promise<void>;
}

const PREVIEW_LIMIT = 4;

/** Collection card — shows name, tab count badge, preview tab list or expanded TabList. */
export const CollectionCard = memo(function CollectionCard({
    collection,
    groupName,
    groupColor,
    onRename,
    onDelete,
    onAddTab,
    onRemoveTab,
    onDuplicateTab,
    onEditTab,
    onReorderTabs,
    onRestore,
}: CollectionCardProps) {
    const [expanded, setExpanded] = useState(false);
    const articleRef = useRef<HTMLElement>(null);
    const [renaming, setRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmRemoveTabId, setConfirmRemoveTabId] = useState<string | null>(
        null,
    );
    const [showAddForm, setShowAddForm] = useState(false);
    const [addUrl, setAddUrl] = useState("");
    const [addUrlError, setAddUrlError] = useState("");
    const [restoring, setRestoring] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!expanded) return;
        function handleOutsideClick(e: MouseEvent) {
            if (!articleRef.current?.contains(e.target as Node)) {
                setExpanded(false);
            }
        }
        document.addEventListener("pointerdown", handleOutsideClick);
        return () =>
            document.removeEventListener("pointerdown", handleOutsideClick);
    }, [expanded]);

    function validateUrl(url: string): boolean {
        return (
            url.trim().startsWith("http://") ||
            url.trim().startsWith("https://")
        );
    }

    function handleAddTabSubmit(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = addUrl.trim();
        if (!validateUrl(trimmed)) {
            setAddUrlError("URL must start with http:// or https://");
            return;
        }
        setAddUrlError("");
        setAddUrl("");
        setShowAddForm(false);
        onAddTab(collection.id, trimmed);
    }

    const barColor = collection.chromeGroupColor
        ? CHROME_GROUP_COLOR_HEX[collection.chromeGroupColor]
        : (groupColor ?? "var(--accent)");

    const preview = collection.tabs.slice(0, PREVIEW_LIMIT);
    const rest = collection.tabs.length - preview.length;
    const updatedAt = new Date(collection.updatedAt).toLocaleDateString(
        undefined,
        {
            month: "short",
            day: "numeric",
        },
    );

    function startRename() {
        setRenameValue(collection.name);
        setRenaming(true);
        // focus handled by autoFocus on input
    }

    function commitRename() {
        const trimmed = renameValue.trim();
        if (trimmed) onRename(collection.id, trimmed);
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
            <article
                ref={articleRef}
                className={`tl-collection${expanded ? " is-expanded" : ""}${isDragOver ? " is-drop-target" : ""}`}
                style={{ "--bar": barColor } as CSSProperties}
                onClick={() => !renaming && setExpanded((v) => !v)}
                aria-expanded={expanded}
                onDragOver={(e) => {
                    if (
                        e.dataTransfer.types.includes(
                            "application/tablocal-tab",
                        )
                    ) {
                        e.preventDefault();
                        setIsDragOver(true);
                    }
                }}
                onDragLeave={(e) => {
                    if (
                        !articleRef.current?.contains(e.relatedTarget as Node)
                    ) {
                        setIsDragOver(false);
                    }
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const raw = e.dataTransfer.getData(
                        "application/tablocal-tab",
                    );
                    if (!raw) return;
                    try {
                        const { url, title, faviconUrl } = JSON.parse(raw) as {
                            url: string;
                            title: string;
                            faviconUrl?: string | null;
                        };
                        if (url)
                            onAddTab(
                                collection.id,
                                url,
                                title,
                                faviconUrl ?? null,
                            );
                    } catch {
                        // ignore malformed drag data
                    }
                }}
            >
                <header className="tl-collection-head">
                    <div className="tl-collection-head-left">
                        {renaming ? (
                            <input
                                ref={inputRef}
                                className="tl-collection-title tl-inline-input"
                                value={renameValue}
                                autoFocus
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={commitRename}
                                onKeyDown={handleRenameKey}
                                aria-label="Rename collection"
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <h3
                                className="tl-collection-title"
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    startRename();
                                }}
                            >
                                {collection.name}
                            </h3>
                        )}
                        <span
                            className="tl-collection-count"
                            aria-label={`${collection.tabs.length} tabs`}
                        >
                            {collection.tabs.length} tab
                            {collection.tabs.length !== 1 ? "s" : ""}
                        </span>
                    </div>

                    <div className="tl-collection-head-right">
                        <button
                            className="tl-btn tl-btn-sm tl-btn-ghost"
                            aria-label="Restore collection"
                            title="Restore tabs"
                            disabled={restoring}
                            aria-busy={restoring}
                            onClick={async (e) => {
                                e.stopPropagation();
                                setRestoring(true);
                                try {
                                    await onRestore(collection.id);
                                } finally {
                                    setRestoring(false);
                                }
                            }}
                        >
                            {restoring ? (
                                <span aria-hidden>…</span>
                            ) : (
                                <Icon name="external" size={12} aria-hidden />
                            )}
                        </button>
                        <button
                            className="tl-btn tl-btn-sm tl-btn-ghost"
                            aria-label="Rename collection"
                            title="Rename"
                            onClick={(e) => {
                                e.stopPropagation();
                                startRename();
                            }}
                        >
                            <Icon name="pencil" size={12} />
                        </button>
                        <button
                            className="tl-btn tl-btn-sm tl-btn-ghost"
                            aria-label="Delete collection"
                            title="Delete"
                            onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete(true);
                            }}
                        >
                            <Icon name="trash" size={12} />
                        </button>
                        <button
                            className="tl-btn tl-btn-sm tl-btn-ghost"
                            aria-label={
                                expanded
                                    ? "Collapse collection"
                                    : "Expand collection"
                            }
                            onClick={(e) => {
                                e.stopPropagation();
                                setExpanded((v) => !v);
                            }}
                            aria-expanded={expanded}
                        >
                            {expanded ? "Collapse" : "Expand"}
                        </button>
                    </div>
                </header>

                <div className="tl-collection-list">
                    {expanded ? (
                        <>
                            {collection.tabs.length === 0 ? (
                                <EmptyState
                                    title="No tabs"
                                    description="This collection is empty."
                                />
                            ) : (
                                <TabList
                                    tabs={collection.tabs}
                                    onRemove={(tabId) =>
                                        setConfirmRemoveTabId(tabId)
                                    }
                                    onDuplicate={(tabId) =>
                                        onDuplicateTab(collection.id, tabId)
                                    }
                                    onEdit={
                                        onEditTab
                                            ? (tabId, url, title) =>
                                                  onEditTab(
                                                      collection.id,
                                                      tabId,
                                                      url,
                                                      title,
                                                  )
                                            : undefined
                                    }
                                    onReorder={(newTabs) =>
                                        onReorderTabs(collection.id, newTabs)
                                    }
                                />
                            )}
                            <div className="tl-add-tab-area">
                                {showAddForm ? (
                                    <form
                                        className="tl-add-tab-form"
                                        onSubmit={handleAddTabSubmit}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            className="tl-add-tab-input"
                                            type="text"
                                            placeholder="https://example.com"
                                            value={addUrl}
                                            autoFocus
                                            onChange={(e) => {
                                                setAddUrl(e.target.value);
                                                setAddUrlError("");
                                            }}
                                            aria-label="Tab URL"
                                            aria-describedby={
                                                addUrlError
                                                    ? "tl-add-tab-error"
                                                    : undefined
                                            }
                                        />
                                        {addUrlError && (
                                            <span
                                                id="tl-add-tab-error"
                                                className="tl-add-tab-error"
                                                role="alert"
                                            >
                                                {addUrlError}
                                            </span>
                                        )}
                                        <div className="tl-add-tab-actions">
                                            <button
                                                type="submit"
                                                className="tl-btn tl-btn-sm tl-btn-primary"
                                            >
                                                Add
                                            </button>
                                            <button
                                                type="button"
                                                className="tl-btn tl-btn-sm tl-btn-ghost"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowAddForm(false);
                                                    setAddUrl("");
                                                    setAddUrlError("");
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <button
                                        className="tl-btn tl-btn-sm tl-btn-ghost tl-add-tab-toggle"
                                        aria-label="Add tab"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowAddForm(true);
                                        }}
                                    >
                                        + Add tab
                                    </button>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            {collection.tabs.length === 0 ? (
                                <EmptyState
                                    title="No tabs"
                                    description="This collection is empty."
                                />
                            ) : (
                                <>
                                    {preview.map((tab) => (
                                        <div
                                            key={tab.id}
                                            className="tl-collection-item"
                                        >
                                            <Favicon tab={tab} size={12} />
                                            <span>{tab.title}</span>
                                        </div>
                                    ))}
                                    {rest > 0 && (
                                        <div className="tl-collection-item is-more">
                                            + {rest} more
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>

                <footer className="tl-collection-foot">
                    <span>{updatedAt}</span>
                    <span className="tl-mono">
                        <span
                            className="tl-color-dot"
                            style={{ background: barColor }}
                            aria-hidden="true"
                        />
                        {groupName ?? "—"}
                    </span>
                </footer>
            </article>

            {confirmDelete && (
                <ConfirmDialog
                    title="Delete collection"
                    message={`Delete "${collection.name}" and all its tabs? This cannot be undone.`}
                    confirmLabel="Delete"
                    onConfirm={() => {
                        setConfirmDelete(false);
                        onDelete(collection.id);
                    }}
                    onCancel={() => setConfirmDelete(false)}
                />
            )}

            {confirmRemoveTabId !== null && (
                <ConfirmDialog
                    title="Remove tab"
                    message="Remove this tab from the collection? This cannot be undone."
                    confirmLabel="Remove"
                    onConfirm={() => {
                        const id = confirmRemoveTabId;
                        setConfirmRemoveTabId(null);
                        onRemoveTab(collection.id, id);
                    }}
                    onCancel={() => setConfirmRemoveTabId(null)}
                />
            )}
        </>
    );
});
