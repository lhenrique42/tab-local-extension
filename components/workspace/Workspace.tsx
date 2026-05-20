import { useState } from 'react';
import type { StorageRoot } from '../../lib/storage/schema';
import { Icon } from '../shared';
import { GroupSection } from './GroupSection';
import { LiveTabsSidebar } from './LiveTabsSidebar';

interface WorkspaceProps {
  root: StorageRoot;
  loading: boolean;
}

/** Root workspace area: renders all groups with their collection card grids. */
export function Workspace({ root, loading }: WorkspaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (loading) {
    return (
      <div className="tl-app">
        <main className="tl-workspace" aria-busy="true" aria-label="Loading workspace">
          <div className="tl-workspace-head">
            <h1 className="tl-workspace-title">Saved</h1>
          </div>
        </main>
      </div>
    );
  }

  const groups = Object.values(root.groups);

  return (
    <div className={`tl-app${sidebarOpen ? '' : ' tl-app--no-sidebar'}`}>
      {sidebarOpen && (
        <LiveTabsSidebar onToggle={() => setSidebarOpen(false)} />
      )}

      <main className="tl-workspace">
        <div className="tl-workspace-head">
          <h1 className="tl-workspace-title">Saved</h1>
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
            Press <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>S</kbd> to save your current window as a collection.
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
              />
            );
          })}
        </div>
      )}
      </main>
    </div>
  );
}
