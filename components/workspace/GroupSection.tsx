import { useState } from 'react';
import type { SavedCollection, SavedGroup } from '../../lib/storage/schema';
import { CHROME_GROUP_COLOR_HEX } from '../../lib/constants/colors';
import { Icon } from '../shared';
import { CollectionCard } from './CollectionCard';

interface GroupSectionProps {
  group: SavedGroup;
  collections: SavedCollection[];
  defaultOpen?: boolean;
}

/** Renders a named group section header with a collapsible collection card grid. */
export function GroupSection({ group, collections, defaultOpen = true }: GroupSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const dotColor = group.color && group.color in CHROME_GROUP_COLOR_HEX
    ? CHROME_GROUP_COLOR_HEX[group.color as keyof typeof CHROME_GROUP_COLOR_HEX]
    : 'var(--fg-tertiary)';

  const collectionCount = collections.length;
  const collectionLabel = `${collectionCount} ${collectionCount === 1 ? 'collection' : 'collections'}`;

  return (
    <section className={`tl-group${open ? '' : ' is-collapsed'}`}>
      <header
        className="tl-group-head"
        onClick={() => setOpen((v) => !v)}
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
        <h2 className="tl-group-name">{group.name}</h2>
        <span className="tl-group-count" aria-label={collectionLabel}>
          {collectionLabel}
        </span>
      </header>

      {open && (
        collections.length === 0 ? (
          <p className="tl-group-empty">No collections in this group yet.</p>
        ) : (
          <div className="tl-grid">
            {collections.map((c) => (
              <CollectionCard key={c.id} collection={c} />
            ))}
          </div>
        )
      )}
    </section>
  );
}
