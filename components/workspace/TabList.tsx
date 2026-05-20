import type { SavedTab } from '../../lib/storage/schema';

interface FaviconProps {
  tab: SavedTab;
  size: number;
}

/** Renders the tab favicon image, falling back to a colored letter tile. */
function Favicon({ tab, size }: FaviconProps) {
  const hostname = (() => {
    try { return new URL(tab.url).hostname; } catch { return ''; }
  })();
  const letter = (tab.title[0] ?? hostname[0] ?? '?').toUpperCase();

  if (tab.faviconUrl) {
    return (
      <>
        <img
          src={tab.faviconUrl}
          alt=""
          width={size}
          height={size}
          style={{ borderRadius: 3, display: 'inline-block', flexShrink: 0 }}
          onError={(e) => {
            const img = e.currentTarget;
            img.style.display = 'none';
            const fallback = img.nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.display = 'inline-flex';
          }}
        />
        <span
          className="tl-favicon-letter"
          style={{ width: size, height: size, fontSize: Math.max(8, size * 0.65), display: 'none' }}
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
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.65) }}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

interface TabListProps {
  tabs: SavedTab[];
}

/** Read-only list of saved tab rows inside an expanded CollectionCard. */
export function TabList({ tabs }: TabListProps) {
  return (
    <div role="list" aria-label="Saved tabs">
      {tabs.map((tab) => (
        <div key={tab.id} className="tl-tab-row is-dense" role="listitem">
          <span className="tl-tab-row-bar" aria-hidden="true" />
          <Favicon tab={tab} size={14} />
          <span className="tl-tab-row-title" title={tab.title}>
            {tab.title}
          </span>
          <span className="tl-tab-row-url" title={tab.url}>
            {(() => { try { return new URL(tab.url).hostname; } catch { return tab.url; } })()}
          </span>
        </div>
      ))}
    </div>
  );
}
