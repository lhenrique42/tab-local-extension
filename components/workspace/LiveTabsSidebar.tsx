import { useState, useEffect } from "react";
import { Icon, EmptyState } from "../shared";
import { useLiveTabs } from "../../lib/hooks/useLiveTabs";
import { sendToBackground } from "../../lib/messaging/client";
import { getStorageUsage } from "../../lib/chrome/storage";
import type { TabInfo } from "../../lib/chrome/tabs";

const STORAGE_QUOTA_MB = 5;

interface SidebarTabRowProps {
  tab: TabInfo;
}

function SidebarTabRow({ tab }: SidebarTabRowProps) {
  const hostname = (() => {
    try {
      return new URL(tab.url).hostname;
    } catch {
      return tab.url;
    }
  })();
  const letter = (tab.title[0] ?? hostname[0] ?? "?").toUpperCase();

  return (
    <div
      className={`tl-side-row${tab.active ? " is-active" : ""}`}
      title={tab.title}
      role="listitem"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/tablocal-tab",
          JSON.stringify({ url: tab.url, title: tab.title, faviconUrl: tab.faviconUrl }),
        );
        e.dataTransfer.effectAllowed = "copy";
      }}
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
            img.style.display = "none";
            const next = img.nextElementSibling as HTMLElement | null;
            if (next) next.style.display = "inline-flex";
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
          display: tab.faviconUrl ? "none" : undefined,
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
  const [saving, setSaving] = useState(false);
  const [usedMb, setUsedMb] = useState(0);

  useEffect(() => {
    getStorageUsage().then(({ usedBytes }) => {
      setUsedMb(usedBytes / (1024 * 1024));
    });
  }, []);

  const usedPct = Math.min((usedMb / STORAGE_QUOTA_MB) * 100, 100);

  async function handleSaveAll() {
    setSaving(true);
    const now = new Date();
    const name = `Window ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
    await sendToBackground({ type: "SAVE_WINDOW", payload: { collectionName: name } });
    setSaving(false);
  }

  return (
    <aside className="tl-sidebar" aria-label="Open tabs">
      <div className="tl-side-section">
        <div className="tl-side-head">
          <span className="tl-eyebrow">This window</span>
          <span className="tl-side-count">
            {tabs.length} tab{tabs.length !== 1 ? "s" : ""}
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

        <div className="tl-side-meta" aria-label="Tab count">
          <Icon name="layers" size={12} aria-hidden />
          <span>{tabs.length} tab{tabs.length !== 1 ? "s" : ""} open</span>
        </div>

        <button
          className="tl-btn tl-btn-secondary tl-btn-block"
          onClick={() => void handleSaveAll()}
          disabled={saving || tabs.length === 0}
          aria-busy={saving}
          aria-label="Save all as collection"
        >
          <Icon name="save" size={14} aria-hidden />
          {saving ? "Saving…" : "Save all as collection"}
        </button>

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

      <div className="tl-side-foot">
        <div className="tl-storage-meter">
          <div className="tl-storage-bar" role="progressbar" aria-valuenow={usedPct} aria-valuemin={0} aria-valuemax={100} aria-label="Storage usage">
            <span style={{ width: `${usedPct}%` }} />
          </div>
          <div className="tl-storage-label">
            <span className="tl-mono">{usedMb.toFixed(1)} / {STORAGE_QUOTA_MB} MB</span>
            <span>storage</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
