import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { SavedCollection } from '../../lib/storage/schema';
import { CHROME_GROUP_COLOR_HEX } from '../../lib/constants/colors';
import { EmptyState } from '../shared';
import { TabList } from './TabList';

interface CollectionCardProps {
  collection: SavedCollection;
}

const PREVIEW_LIMIT = 4;

/** Collection card — shows name, tab count badge, preview tab list or expanded TabList. */
export function CollectionCard({ collection }: CollectionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const barColor = collection.chromeGroupColor
    ? CHROME_GROUP_COLOR_HEX[collection.chromeGroupColor]
    : 'var(--accent)';

  const preview = collection.tabs.slice(0, PREVIEW_LIMIT);
  const rest = collection.tabs.length - preview.length;
  const updatedAt = new Date(collection.updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <article
      className={`tl-collection${expanded ? ' is-expanded' : ''}`}
      style={{ '--bar': barColor } as CSSProperties}
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
    >
      <header className="tl-collection-head">
        <div className="tl-collection-head-left">
          <h3 className="tl-collection-title">{collection.name}</h3>
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
  );
}
