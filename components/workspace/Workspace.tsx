import { useState, useMemo } from "react";
import { nanoid } from "nanoid";
import type { StorageRoot, SavedTab } from "../../lib/storage/schema";
import { storage } from "../../lib/storage/adapter";
import { sendToBackground } from "../../lib/messaging/client";
import { createTab } from "../../lib/chrome/tabs";
import { Icon } from "../shared";
import { Header } from "./Header";
import { GroupSection } from "./GroupSection";
import { LiveTabsSidebar } from "./LiveTabsSidebar";

interface WorkspaceProps {
  root: StorageRoot;
  loading: boolean;
}

/** Root workspace area: renders all groups with their collection card grids. */
export function Workspace({ root, loading }: WorkspaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Stats for header                                                  */
  /* ---------------------------------------------------------------- */

  const allGroups = Object.values(root.groups);
  const allCollections = Object.values(root.collections);
  const totalTabs = allCollections.reduce((sum, c) => sum + c.tabs.length, 0);

  /* ---------------------------------------------------------------- */
  /*  Search filtering                                                  */
  /* ---------------------------------------------------------------- */

  const visibleGroups = useMemo(() => {
    const groups = Object.values(root.groups);
    if (!query.trim()) return groups;
    const q = query.toLowerCase();
    return groups
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
  }, [root.groups, root.collections, query]);

  /* ---------------------------------------------------------------- */
  /*  Mutation helpers — all via storage.patch                         */
  /* ---------------------------------------------------------------- */

  function handleNewGroup() {
    const id = nanoid();
    const now = Date.now();
    void storage.patch((draft) => {
      draft.groups[id] = {
        id,
        name: "New Group",
        color: "grey",
        collectionIds: [],
        createdAt: now,
        updatedAt: now,
      };
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

  function handleAddTab(collectionId: string, url: string) {
    const id = nanoid();
    const now = Date.now();
    void storage.patch((draft) => {
      if (draft.collections[collectionId]) {
        draft.collections[collectionId].tabs.push({
          id,
          url,
          title: url,
          faviconUrl: null,
          addedAt: now,
        });
        draft.collections[collectionId].updatedAt = now;
      }
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
    await sendToBackground({
      type: "RESTORE_COLLECTION",
      payload: { collectionId, newWindow: false },
    });
  }

  async function handleSaveSession() {
    setSaving(true);
    const now = new Date();
    const name = `Session ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
    await sendToBackground({ type: "SAVE_WINDOW", payload: { collectionName: name } });
    setSaving(false);
  }

  function handleToggleTheme() {
    void storage.patch((draft) => {
      const next: Record<string, string> = { dark: "light", light: "system", system: "dark" };
      draft.settings.theme = (next[draft.settings.theme] ?? "dark") as typeof draft.settings.theme;
    });
  }

  function handleOpenSettings() {
    void createTab(chrome.runtime.getURL("settings.html"));
  }

  const headerProps = {
    totalGroups: allGroups.length,
    totalCollections: allCollections.length,
    totalTabs,
    query,
    onQueryChange: setQuery,
    theme: root.settings.theme,
    onSaveSession: () => void handleSaveSession(),
    saving,
    onToggleTheme: handleToggleTheme,
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
              {query.trim() ? `No results for "${query}"` : "No collections yet"}
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
          <div className="tl-groups">
            {visibleGroups.map((group) => {
              const collections = group.collectionIds
                .map((id) => root.collections[id])
                .filter(Boolean);
              return (
                <GroupSection
                  key={group.id}
                  group={group}
                  collections={collections}
                  onNewCollection={handleNewCollection}
                  onRenameGroup={handleRenameGroup}
                  onDeleteGroup={handleDeleteGroup}
                  onRenameCollection={handleRenameCollection}
                  onDeleteCollection={handleDeleteCollection}
                  onAddTab={handleAddTab}
                  onRemoveTab={handleRemoveTab}
                  onDuplicateTab={handleDuplicateTab}
                  onReorderTabs={handleReorderTabs}
                  onReorderCollections={handleReorderCollections}
                  onRestore={handleRestore}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
