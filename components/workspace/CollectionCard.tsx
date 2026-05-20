import { useState, useRef } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { SavedCollection } from '../../lib/storage/schema';
import { CHROME_GROUP_COLOR_HEX } from '../../lib/constants/colors';
import { EmptyState, Icon, ConfirmDialog } from '../shared';
import { TabList } from './TabList';

interface CollectionCardProps {
  collection: SavedCollection;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

const PREVIEW_LIMIT = 4;

/** Collection card — shows name, tab count badge, preview tab list or expanded TabList. */
export function CollectionCard({ collection, onRename, onDelete }: CollectionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const barColor = collection.chromeGroupColor
    ? CHROME_GROUP_COLOR_HEX[collection.chromeGroupColor]
    : 'var(--accent)';

  const preview = collection.tabs.slice(0, PREVIEW_LIMIT);
  const rest = collection.tabs.length - preview.length;
  const updatedAt = new Date(collection.updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

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
    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
    if (e.key === 'Escape') { setRenaming(false); }
  }

  return (
    <>
      <article
        className={`tl-collection${expanded ? ' is-expanded' : ''}`}
        style={{ '--bar': barColor } as CSSProperties}
        onClick={() => !renaming && setExpanded((v) => !v)}
        aria-expanded={expanded}
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
                onDoubleClick={(e) => { e.stopPropagation(); startRename(); }}
              >
                {collection.name}
              </h3>
            )}
            <span
              className="tl-collection-count"
              aria-label={`${collection.tabs.length} tabs`}
            >
              {collection.tabs.length} tab{collection.tabs.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="tl-collection-head-right">
            <button
              className="tl-btn tl-btn-sm tl-btn-ghost"
              aria-label="Rename collection"
              title="Rename"
              onClick={(e) => { e.stopPropagation(); startRename(); }}
            >
              <Icon name="save" size={12} />
            </button>
            <button
              className="tl-btn tl-btn-sm tl-btn-ghost"
              aria-label="Delete collection"
              title="Delete"
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
            >
              <Icon name="trash" size={12} />
            </button>
            <button
              className="tl-btn tl-btn-sm tl-btn-ghost"
              aria-label={expanded ? 'Collapse collection' : 'Expand collection'}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              aria-expanded={expanded}
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </header>

        <div className="tl-collection-list">
          {collection.tabs.length === 0 ? (
            <EmptyState title="No tabs" description="This collection is empty." />
          ) : expanded ? (
            <TabList tabs={collection.tabs} />
          ) : (
            <>
              {preview.map((tab) => (
                <div key={tab.id} className="tl-collection-item">
                  <span
                    className="tl-favicon-letter"
                    style={{ width: 12, height: 12, fontSize: 8 }}
                    aria-hidden="true"
                  >
                    {(tab.title[0] ?? '?').toUpperCase()}
                  </span>
                  <span>{tab.title}</span>
                </div>
              ))}
              {rest > 0 && (
                <div className="tl-collection-item is-more">+ {rest} more</div>
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
            {collection.groupId ?? '—'}
          </span>
        </footer>
      </article>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete collection"
          message={`Delete "${collection.name}" and all its tabs? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => { setConfirmDelete(false); onDelete(collection.id); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

