import { useState } from "react";
import { nanoid } from "nanoid";
import type { StorageRoot, SavedTab } from "../../lib/storage/schema";
import { storage } from "../../lib/storage/adapter";
import { Icon } from "../shared";
import { GroupSection } from "./GroupSection";
import { LiveTabsSidebar } from "./LiveTabsSidebar";

interface WorkspaceProps {
  root: StorageRoot;
  loading: boolean;
}

/** Root workspace area: renders all groups with their collection card grids. */
export function Workspace({ root, loading }: WorkspaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  if (loading) {
    return (
      <div className="tl-app">
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

  const groups = Object.values(root.groups);

  return (
    <div className={`tl-app${sidebarOpen ? "" : " tl-app--no-sidebar"}`}>
      {sidebarOpen && (
        <LiveTabsSidebar onToggle={() => setSidebarOpen(false)} />
      )}

      <main className="tl-workspace">
        <div className="tl-workspace-head">
          <h1 className="tl-workspace-title">Saved</h1>
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

        {groups.length === 0 ? (
          <div className="tl-workspace-empty" role="status">
            <p className="tl-workspace-empty__title">No collections yet</p>
            <p className="tl-workspace-empty__body">
              Press <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>S</kbd> to save your current
              window as a collection.
            </p>
          </div>
        ) : (
          <div className="tl-groups">
            {groups.map((group) => {
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
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
