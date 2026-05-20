import { Icon, EmptyState } from '../shared';
import { useLiveTabs } from '../../lib/hooks/useLiveTabs';
import type { TabInfo } from '../../lib/chrome/tabs';

interface SidebarTabRowProps {
  tab: TabInfo;
}

function SidebarTabRow({ tab }: SidebarTabRowProps) {
  const hostname = (() => {
    try { return new URL(tab.url).hostname; } catch { return tab.url; }
  })();
  const letter = (tab.title[0] ?? hostname[0] ?? '?').toUpperCase();

  return (
    <div
      className={`tl-side-row${tab.active ? ' is-active' : ''}`}
      title={tab.title}
      role="listitem"
    >
      <span className="tl-grip" aria-hidden="true">
        <Icon name="grip" size={14} />
      </span>

      {tab.faviconUrl ? (
        <img
          src={tab.faviconUrl}
          alt=""
          width={14}
          height={14}
          style={{ borderRadius: 2, flexShrink: 0 }}
          onError={(e) => {
            const img = e.currentTarget;
            img.style.display = 'none';
            const next = img.nextElementSibling as HTMLElement | null;
            if (next) next.style.display = 'inline-flex';
          }}
        />
      ) : null}
      <span
        className="tl-favicon"
        style={{
          width: 14,
          height: 14,
          borderRadius: 2,
          fontSize: 8,
          display: tab.faviconUrl ? 'none' : undefined,
        }}
        aria-hidden="true"
      >
        {letter}
      </span>

      <span className="tl-side-title">{tab.title}</span>
      <span className="tl-side-url">{hostname}</span>
    </div>
  );
}

interface LiveTabsSidebarProps {
  onToggle: () => void;
}

/** Sidebar showing currently open tabs, refreshing on Chrome tab events. */
export function LiveTabsSidebar({ onToggle }: LiveTabsSidebarProps) {
  const tabs = useLiveTabs();

  return (
    <aside className="tl-sidebar" aria-label="Open tabs">
      <div className="tl-side-section">
        <div className="tl-side-head">
          <span className="tl-eyebrow">This window</span>
          <span className="tl-side-count">
            {tabs.length} tab{tabs.length !== 1 ? 's' : ''}
          </span>
          <button
            className="tl-btn tl-btn-icon tl-btn-sm tl-btn-ghost"
            aria-label="Hide sidebar"
            onClick={onToggle}
            title="Hide sidebar"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="tl-side-divider" />

        {tabs.length === 0 ? (
          <EmptyState title="No tabs" description="All tabs are closed." />
        ) : (
          <div className="tl-side-list" role="list" aria-label="Open tab list">
            {tabs.map((tab) => (
              <SidebarTabRow key={tab.id} tab={tab} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
