import React, {
  useState,
  useMemo,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
import { nanoid } from "nanoid";
import type {
  StorageRoot,
  SavedGroup,
  SavedTab,
} from "../../lib/storage/schema";
import { storage } from "../../lib/storage/adapter";
import { sendToBackground } from "../../lib/messaging/client";
import { Icon } from "../shared";
import { Header } from "./Header";
import { GroupSection } from "./GroupSection";
import { LiveTabsSidebar } from "./LiveTabsSidebar";
import { Settings } from "../settings";
import { SESSIONS_GROUP_ID } from "../../lib/storage/defaults";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ---------------------------------------------------------------- */
/*  SortableGroupWrapper                                             */
/* ---------------------------------------------------------------- */

interface SortableGroupWrapperProps {
  id: string;
  children: (
    dragHandleProps: HTMLAttributes<HTMLButtonElement> | null,
  ) => React.ReactNode;
}

function SortableGroupWrapper({ id, children }: SortableGroupWrapperProps) {
  const isFixed = id === SESSIONS_GROUP_ID;
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id,
      disabled: isFixed,
    });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children(
        isFixed
          ? null
          : ({
              ...attributes,
              ...listeners,
            } as HTMLAttributes<HTMLButtonElement>),
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  Workspace                                                        */
/* ---------------------------------------------------------------- */

interface WorkspaceProps {
  root: StorageRoot;
  loading: boolean;
}

/** Root workspace area: renders all groups with their collection card grids. */
export function Workspace({ root, loading }: WorkspaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const groupDndSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  /* ---------------------------------------------------------------- */
  /*  Stats for header                                                  */
  /* ---------------------------------------------------------------- */

  const allGroups = Object.values(root.groups);
  const allCollections = Object.values(root.collections);
  const totalTabs = allCollections.reduce((sum, c) => sum + c.tabs.length, 0);

  /* ---------------------------------------------------------------- */
  /*  Group ordering: sessions always first, rest by groupOrder        */
  /* ---------------------------------------------------------------- */

  const orderedGroupIds = useMemo(() => {
    const allGroupIds = Object.keys(root.groups);
    const order = root.groupOrder ?? allGroupIds;
    const seen = new Set<string>();
    const result: string[] = [];
    // sessions always first if it exists in groups
    if (root.groups[SESSIONS_GROUP_ID]) {
      result.push(SESSIONS_GROUP_ID);
      seen.add(SESSIONS_GROUP_ID);
    }
    // groups from stored order
    for (const id of order) {
      if (!seen.has(id) && root.groups[id]) {
        result.push(id);
        seen.add(id);
      }
    }
    // any groups not captured by groupOrder (handles legacy/test data)
    for (const id of allGroupIds) {
      if (!seen.has(id)) {
        result.push(id);
        seen.add(id);
      }
    }
    return result;
  }, [root.groups, root.groupOrder]);

  /* ---------------------------------------------------------------- */
  /*  Search filtering (preserves orderedGroupIds order)              */
  /* ---------------------------------------------------------------- */

  const visibleGroups = useMemo(() => {
    const ordered = orderedGroupIds
      .map((id) => root.groups[id])
      .filter(Boolean) as SavedGroup[];
    if (!query.trim()) return ordered;
    const q = query.toLowerCase();
    return ordered
      .map((g) => {
        const matchGroup = g.name.toLowerCase().includes(q);
        const matchedCollectionIds = g.collectionIds.filter((cid) => {
          const c = root.collections[cid];
          if (!c) return false;
          if (c.name.toLowerCase().includes(q)) return true;
          return c.tabs.some(
            (t) =>
              t.title.toLowerCase().includes(q) ||
              t.url.toLowerCase().includes(q),
          );
        });
        if (matchGroup) return g;
        if (matchedCollectionIds.length > 0) {
          return { ...g, collectionIds: matchedCollectionIds };
        }
        return null;
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  }, [root.groups, root.collections, orderedGroupIds, query]);

  /* ---------------------------------------------------------------- */
  /*  Mutation helpers — all via storage.patch                         */
  /* ---------------------------------------------------------------- */

  function handleNewGroup() {
    const id = nanoid();
    const now = Date.now();
    const COLOR_CYCLE = [
      "blue",
      "purple",
      "green",
      "orange",
      "red",
      "pink",
      "cyan",
      "yellow",
    ] as const;
    void storage.patch((draft) => {
      const nextColor =
        COLOR_CYCLE[Object.keys(draft.groups).length % COLOR_CYCLE.length];
      draft.groups[id] = {
        id,
        name: "New Group",
        color: nextColor,
        collectionIds: [],
        createdAt: now,
        updatedAt: now,
      };
      if (!draft.groupOrder) {
        draft.groupOrder = Object.keys(draft.groups);
      } else {
        draft.groupOrder.push(id);
      }
    });
  }

  function handleNewCollection(groupId: string) {
    const id = nanoid();
    const now = Date.now();
    void storage.patch((draft) => {
      draft.collections[id] = {
        id,
        name: "New Collection",
        groupId,
        chromeGroupColor: null,
        tabs: [],
        createdAt: now,
        updatedAt: now,
      };
      if (draft.groups[groupId]) {
        draft.groups[groupId].collectionIds.push(id);
        draft.groups[groupId].updatedAt = now;
      }
    });
  }

  function handleRenameGroup(id: string, name: string) {
    void storage.patch((draft) => {
      if (draft.groups[id]) {
        draft.groups[id].name = name;
        draft.groups[id].updatedAt = Date.now();
      }
    });
  }

  function handleDeleteGroup(id: string) {
    void storage.patch((draft) => {
      const collectionIds = draft.groups[id]?.collectionIds ?? [];
      for (const cid of collectionIds) {
        delete draft.collections[cid];
      }
      delete draft.groups[id];
      if (draft.groupOrder) {
        draft.groupOrder = draft.groupOrder.filter((gid) => gid !== id);
      }
    });
  }

  function handleRenameCollection(id: string, name: string) {
    void storage.patch((draft) => {
      if (draft.collections[id]) {
        draft.collections[id].name = name;
        draft.collections[id].updatedAt = Date.now();
      }
    });
  }

  function handleDeleteCollection(id: string) {
    void storage.patch((draft) => {
      const collection = draft.collections[id];
      if (collection?.groupId && draft.groups[collection.groupId]) {
        draft.groups[collection.groupId].collectionIds = draft.groups[
          collection.groupId
        ].collectionIds.filter((cid) => cid !== id);
      }
      delete draft.collections[id];
    });
  }

  function handleAddTab(
    collectionId: string,
    url: string,
    title?: string,
    faviconUrl?: string | null,
  ) {
    const id = nanoid();
    const now = Date.now();
    void storage.patch((draft) => {
      if (draft.collections[collectionId]) {
        draft.collections[collectionId].tabs.push({
          id,
          url,
          title: title ?? url,
          faviconUrl: faviconUrl ?? null,
          addedAt: now,
        });
        draft.collections[collectionId].updatedAt = now;
      }
    });
  }

  function handleEditTab(
    collectionId: string,
    tabId: string,
    newUrl: string,
    newTitle: string,
  ) {
    void storage.patch((draft) => {
      const col = draft.collections[collectionId];
      if (!col) return;
      const tab = col.tabs.find((t) => t.id === tabId);
      if (!tab) return;
      tab.url = newUrl;
      tab.title = newTitle || newUrl;
      col.updatedAt = Date.now();
    });
  }

  function handleReorderGroups(newOrderedIds: string[]) {
    void storage.patch((draft) => {
      draft.groupOrder = newOrderedIds;
    });
  }

  function handleRemoveTab(collectionId: string, tabId: string) {
    void storage.patch((draft) => {
      if (draft.collections[collectionId]) {
        draft.collections[collectionId].tabs = draft.collections[
          collectionId
        ].tabs.filter((t) => t.id !== tabId);
        draft.collections[collectionId].updatedAt = Date.now();
      }
    });
  }

  function handleDuplicateTab(collectionId: string, tabId: string) {
    const newId = nanoid();
    const now = Date.now();
    void storage.patch((draft) => {
      const col = draft.collections[collectionId];
      if (col) {
        const source = col.tabs.find((t) => t.id === tabId);
        if (source) {
          col.tabs.push({ ...source, id: newId, addedAt: now });
          col.updatedAt = now;
        }
      }
    });
  }

  function handleReorderTabs(collectionId: string, newTabs: SavedTab[]) {
    void storage.patch((draft) => {
      if (draft.collections[collectionId]) {
        draft.collections[collectionId].tabs = newTabs;
        draft.collections[collectionId].updatedAt = Date.now();
      }
    });
  }

  function handleReorderCollections(groupId: string, newIds: string[]) {
    void storage.patch((draft) => {
      if (draft.groups[groupId]) {
        draft.groups[groupId].collectionIds = newIds;
        draft.groups[groupId].updatedAt = Date.now();
      }
    });
  }

  async function handleRestore(collectionId: string) {
    const newWindow = root.settings.defaultRestoreMode === "discard-background";
    await sendToBackground({
      type: "RESTORE_COLLECTION",
      payload: { collectionId, newWindow },
    });
  }

  async function handleSaveSession() {
    setSaving(true);
    const now = new Date();
    const name = `Session ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
    await sendToBackground({
      type: "SAVE_WINDOW",
      payload: { collectionName: name },
    });
    setSaving(false);
  }

  function handleOpenSettings() {
    setShowSettings(true);
  }

  const headerProps = {
    totalGroups: allGroups.length,
    totalCollections: allCollections.length,
    totalTabs,
    query,
    onQueryChange: setQuery,
    onSaveSession: () => void handleSaveSession(),
    saving,
    onOpenSettings: handleOpenSettings,
  };

  if (loading) {
    return (
      <div className="tl-app">
        <Header {...headerProps} />
        <main
          className="tl-workspace"
          aria-busy="true"
          aria-label="Loading workspace"
        >
          <div className="tl-workspace-head">
            <h1 className="tl-workspace-title">Saved</h1>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`tl-app${sidebarOpen ? "" : " tl-app--no-sidebar"}`}>
      <Header {...headerProps} />

      {showSettings && (
        <div
          className="tl-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
        >
          <div className="tl-modal-panel">
            <button
              className="tl-modal-close tl-btn tl-btn-ghost tl-btn-icon"
              aria-label="Close settings"
              onClick={() => setShowSettings(false)}
            >
              <Icon name="x" size={16} />
            </button>
            <Settings />
          </div>
        </div>
      )}

      {sidebarOpen && (
        <LiveTabsSidebar onToggle={() => setSidebarOpen(false)} />
      )}

      <main className="tl-workspace">
        <div className="tl-workspace-head">
          <h1 className="tl-workspace-title">
            {query.trim() ? `Search · "${query}"` : "Saved"}
          </h1>
          <button
            className="tl-btn tl-btn-sm tl-btn-secondary"
            aria-label="New group"
            onClick={handleNewGroup}
          >
            <Icon name="plus" size={12} />
            New Group
          </button>
          {!sidebarOpen && (
            <button
              className="tl-btn tl-btn-sm tl-btn-ghost"
              aria-label="Show sidebar"
              onClick={() => setSidebarOpen(true)}
            >
              <Icon name="layers" size={14} />
              Open tabs
            </button>
          )}
        </div>

        {visibleGroups.length === 0 ? (
          <div className="tl-workspace-empty" role="status">
            <p className="tl-workspace-empty__title">
              {query.trim()
                ? `No results for "${query}"`
                : "No collections yet"}
            </p>
            <p className="tl-workspace-empty__body">
              {query.trim() ? (
                "Try a different search term."
              ) : (
                <>
                  Press <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>S</kbd> to save your
                  current window as a collection.
                </>
              )}
            </p>
          </div>
        ) : (
          <DndContext
            sensors={groupDndSensors}
            collisionDetection={closestCenter}
            onDragStart={(e) => setActiveGroupId(String(e.active.id))}
            onDragEnd={(event: DragEndEvent) => {
              setActiveGroupId(null);
              const { active, over } = event;
              if (!over || active.id === over.id) return;
              const currentOrder = root.groupOrder ?? orderedGroupIds;
              const oldIdx = currentOrder.findIndex(
                (id) => id === String(active.id),
              );
              const newIdx = currentOrder.findIndex(
                (id) => id === String(over.id),
              );
              if (oldIdx === -1 || newIdx === -1) return;
              const moved = arrayMove([...currentOrder], oldIdx, newIdx);
              handleReorderGroups([
                SESSIONS_GROUP_ID,
                ...moved.filter((id) => id !== SESSIONS_GROUP_ID),
              ]);
            }}
          >
            <SortableContext
              items={orderedGroupIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="tl-groups">
                {visibleGroups.map((group) => {
                  const collections = group.collectionIds
                    .map((id) => root.collections[id])
                    .filter(Boolean);
                  return (
                    <SortableGroupWrapper key={group.id} id={group.id}>
                      {(dragHandleProps) => (
                        <GroupSection
                          group={group}
                          collections={collections}
                          dragHandleProps={dragHandleProps ?? undefined}
                          onNewCollection={handleNewCollection}
                          onRenameGroup={handleRenameGroup}
                          onDeleteGroup={handleDeleteGroup}
                          onRenameCollection={handleRenameCollection}
                          onDeleteCollection={handleDeleteCollection}
                          onAddTab={handleAddTab}
                          onRemoveTab={handleRemoveTab}
                          onDuplicateTab={handleDuplicateTab}
                          onEditTab={handleEditTab}
                          onReorderTabs={handleReorderTabs}
                          onReorderCollections={handleReorderCollections}
                          onRestore={handleRestore}
                        />
                      )}
                    </SortableGroupWrapper>
                  );
                })}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeGroupId
                ? (() => {
                    const g = root.groups[activeGroupId];
                    return g ? (
                      <div className="tl-drag-overlay-card">
                        <span className="tl-group-name">{g.name}</span>
                      </div>
                    ) : null;
                  })()
                : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>
    </div>
  );
}
