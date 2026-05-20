import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { SavedCollection, SavedGroup } from '../../lib/storage/schema';
import { CHROME_GROUP_COLOR_HEX } from '../../lib/constants/colors';
import { Icon, ConfirmDialog } from '../shared';
import { CollectionCard } from './CollectionCard';

interface GroupSectionProps {
  group: SavedGroup;
  collections: SavedCollection[];
  defaultOpen?: boolean;
  onNewCollection: (groupId: string) => void;
  onRenameGroup: (id: string, name: string) => void;
  onDeleteGroup: (id: string) => void;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
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
}: GroupSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dotColor = group.color && group.color in CHROME_GROUP_COLOR_HEX
    ? CHROME_GROUP_COLOR_HEX[group.color as keyof typeof CHROME_GROUP_COLOR_HEX]
    : 'var(--fg-tertiary)';

  const collectionCount = collections.length;
  const collectionLabel = `${collectionCount} ${collectionCount === 1 ? 'collection' : 'collections'}`;

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
    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
    if (e.key === 'Escape') { setRenaming(false); }
  }

  return (
    <>
      <section className={`tl-group${open ? '' : ' is-collapsed'}`}>
        <header
          className="tl-group-head"
          onClick={() => !renaming && setOpen((v) => !v)}
          aria-expanded={open}
        >
          <button
            className="tl-group-chevron"
            aria-label={open ? 'Collapse group' : 'Expand group'}
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
              onDoubleClick={(e) => { e.stopPropagation(); startRename(); }}
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
            onClick={(e) => { e.stopPropagation(); startRename(); }}
          >
            <Icon name="save" size={12} />
          </button>

          <button
            className="tl-btn tl-btn-sm tl-btn-ghost"
            aria-label="New collection"
            title="New collection in this group"
            onClick={(e) => { e.stopPropagation(); onNewCollection(group.id); }}
          >
            <Icon name="plus" size={12} />
          </button>

          <button
            className="tl-btn tl-btn-sm tl-btn-ghost"
            aria-label="Delete group"
            title="Delete group"
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
          >
            <Icon name="trash" size={12} />
          </button>
        </header>

        {open && (
          collections.length === 0 ? (
            <p className="tl-group-empty">No collections in this group yet.</p>
          ) : (
            <div className="tl-grid">
              {collections.map((c) => (
                <CollectionCard
                  key={c.id}
                  collection={c}
                  onRename={onRenameCollection}
                  onDelete={onDeleteCollection}
                />
              ))}
            </div>
          )
        )}
      </section>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete group"
          message={`Delete "${group.name}" and all ${collectionCount} collection${collectionCount !== 1 ? 's' : ''}? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => { setConfirmDelete(false); onDeleteGroup(group.id); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
