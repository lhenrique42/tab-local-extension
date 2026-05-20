import { useState, useEffect, useRef } from "react";
import { Icon, EmptyState } from "../shared";
import { useStorage } from "../../lib/hooks/useStorage";
import { sendToBackground } from "../../lib/messaging/client";
import { createTab, getCurrentWindowTabs } from "../../lib/chrome/tabs";
import type { SavedCollection } from "../../lib/storage/schema";
import type { TabInfo } from "../../lib/chrome/tabs";
import { storage } from "../../lib/storage/adapter";
import { nanoid } from "nanoid";
import { Settings } from "../settings";
import { SESSIONS_GROUP_ID } from "../../lib/storage/defaults";
import { CHROME_GROUP_COLOR_HEX } from "../../lib/constants/colors";

/* ------------------------------------------------------------------ */
/*  Logo                                                                */
/* ------------------------------------------------------------------ */

function PopupLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 22 L8 52 Q8 56 12 56 L52 56 Q56 56 56 52 L56 22 L40 22 L36 16 L8 16 Q8 16 8 22 Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M14 28 L14 48 Q14 50 16 50 L48 50 Q50 50 50 48 L50 28 L38 28 L35 24 L14 24 Q14 24 14 28 Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
        fill="none"
        opacity="0.8"
      />
      <path
        d="M20 34 L20 44 L44 44 L44 34 L36 34 L33.5 31 L20 31 Z"
        fill="#C7F25C"
      />
      <circle cx="32" cy="39" r="1.8" fill="#0B0D11" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Current-page card                                                   */
/* ------------------------------------------------------------------ */

function PageCard({ tab }: { tab: TabInfo }) {
  const hostname = (() => {
    try {
      return new URL(tab.url).hostname;
    } catch {
      return tab.url;
    }
  })();
  const letter = (tab.title[0] ?? hostname[0] ?? "?").toUpperCase();

  const LETTER_COLORS = [
    "#4A90E2",
    "#E89A4A",
    "#5CB87E",
    "#E25C5C",
    "#9B6BE2",
    "#4DBDBD",
    "#F5C242",
    "#E26AA5",
  ];
  const color = LETTER_COLORS[letter.charCodeAt(0) % LETTER_COLORS.length];

  return (
    <div className="tl-pp-now-row">
      <span
        className="tl-pp-now-fav"
        style={{ background: color }}
        aria-hidden="true"
      >
        {letter}
      </span>
      <div className="tl-pp-now-meta">
        <div className="tl-pp-now-title" title={tab.title}>
          {tab.title}
        </div>
        <div className="tl-pp-now-url">{hostname}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Recent collection row                                               */
/* ------------------------------------------------------------------ */

function RecentCollectionRow({
  collection,
  groupColor,
  onClick,
}: {
  collection: SavedCollection;
  groupColor: string | null;
  onClick?: () => void;
}) {
  const tabCount = collection.tabs.length;
  const dotColor = collection.chromeGroupColor
    ? CHROME_GROUP_COLOR_HEX[collection.chromeGroupColor]
    : (groupColor ?? "var(--fg-tertiary)");
  return (
    <div
      className="tl-pp-coll"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      aria-label={`Add current tab to ${collection.name}`}
    >
      <span
        className="tl-pp-coll-dot"
        style={{ background: dotColor }}
        aria-hidden="true"
      />
      <span className="tl-pp-coll-name">{collection.name}</span>
      <span className="tl-pp-coll-count">{tabCount}</span>
      <span className="tl-pp-coll-add" aria-hidden="true">
        <Icon name="plus" size={14} />
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toast banner                                                        */
/* ------------------------------------------------------------------ */

type BannerState =
  | { kind: "success"; name: string }
  | { kind: "error"; message: string }
  | null;

function Banner({ banner }: { banner: BannerState }) {
  if (!banner) return null;
  if (banner.kind === "success") {
    return (
      <div className="tl-pp-saved-banner" role="status" aria-live="polite">
        <Icon name="check" size={14} />
        <span>
          Saved as <strong>{banner.name}</strong>
        </span>
      </div>
    );
  }
  return (
    <div className="tl-pp-saved-banner tl-pp-saved-banner--error" role="alert">
      <Icon name="x" size={14} />
      <span>{banner.message}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Popup                                                          */
/* ------------------------------------------------------------------ */

function buildDefaultName(): string {
  const now = new Date();
  return `Session ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
}

export function Popup() {
  const [root, loading] = useStorage();
  const [saving, setSaving] = useState(false);
  const [grouping, setGrouping] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);
  const [windowTabs, setWindowTabs] = useState<TabInfo[]>([]);
  const [newCollName, setNewCollName] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const newCollInputRef = useRef<HTMLInputElement>(null);

  const autoGroupEnabled = root.settings.autoGroupByDomainEnabled;

  // Fetch current window tabs on mount for page card and tab count
  useEffect(() => {
    getCurrentWindowTabs().then(setWindowTabs);
  }, []);

  const activeTab = windowTabs.find((t) => t.active) ?? null;
  const tabCount = windowTabs.length;

  // Sort collections by createdAt descending, take 3, with resolved group color
  const recentCollections = Object.values(root.collections)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3)
    .map((c) => {
      const group = c.groupId ? root.groups[c.groupId] : null;
      const groupColor = group?.color
        ? (CHROME_GROUP_COLOR_HEX[
            group.color as keyof typeof CHROME_GROUP_COLOR_HEX
          ] ?? null)
        : null;
      return { collection: c, groupColor };
    });

  function showBanner(next: BannerState) {
    setBanner(next);
    setTimeout(() => setBanner(null), 2000);
  }

  async function handleSaveSession(name = buildDefaultName()) {
    setSaving(true);
    const response = await sendToBackground({
      type: "SAVE_WINDOW",
      payload: { collectionName: name },
    });
    setSaving(false);

    if (response.ok) {
      showBanner({ kind: "success", name });
    } else {
      showBanner({ kind: "error", message: response.error });
    }
  }

  async function handleNewCollSave() {
    const trimmed = newCollName.trim();
    if (!trimmed) return;

    const id = nanoid();
    const now = Date.now();
    await storage.patch((draft) => {
      const groupId = draft.groups[SESSIONS_GROUP_ID]
        ? SESSIONS_GROUP_ID
        : (Object.keys(draft.groups)[0] ?? null);
      draft.collections[id] = {
        id,
        name: trimmed,
        groupId,
        chromeGroupColor: null,
        tabs: [],
        createdAt: now,
        updatedAt: now,
      };
      if (groupId && draft.groups[groupId]) {
        draft.groups[groupId].collectionIds.push(id);
      }
    });
    setNewCollName("");
    showBanner({ kind: "success", name: trimmed });
  }

  async function handleAddToCollection(collectionId: string) {
    if (!activeTab) return;
    const id = nanoid();
    const now = Date.now();
    await storage.patch((draft) => {
      if (draft.collections[collectionId]) {
        draft.collections[collectionId].tabs.push({
          id,
          url: activeTab.url,
          title: activeTab.title,
          faviconUrl: activeTab.faviconUrl,
          addedAt: now,
        });
        draft.collections[collectionId].updatedAt = now;
      }
    });
    const collName = root.collections[collectionId]?.name ?? "collection";
    showBanner({ kind: "success", name: collName });
  }

  function handleOpenWorkspace() {
    void createTab("chrome://newtab", true);
    window.close();
  }

  function handleOpenSettings() {
    setShowSettings(true);
  }

  async function handleAutoGroup() {
    setGrouping(true);
    const response = await sendToBackground({
      type: "AUTO_GROUP_WINDOW",
      payload: {},
    });
    setGrouping(false);

    if (!response.ok) {
      showBanner({ kind: "error", message: response.error });
    }
  }

  if (showSettings) {
    return (
      <div
        className="tl-popup tl-popup--settings"
        role="dialog"
        aria-label="TabLocal Settings"
      >
        <header className="tl-pp-head">
          <button
            className="tl-btn tl-btn-ghost tl-btn-icon"
            onClick={() => setShowSettings(false)}
            aria-label="Back to popup"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ transform: "rotate(90deg)" }}
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="tl-pp-head-title">Settings</span>
        </header>
        <div style={{ overflowY: "auto", flex: 1 }}>
          <Settings />
        </div>
      </div>
    );
  }

  return (
    <div className="tl-popup" role="dialog" aria-label="TabLocal popup">
      {/* Header */}
      <header className="tl-pp-head">
        <span className="tl-pp-head-logo">
          <PopupLogo />
        </span>
        <span className="tl-pp-head-title">TabLocal</span>
        <span className="tl-pp-head-eyebrow">
          {tabCount > 0 ? `local · ${tabCount}` : "local"}
        </span>
        <button
          className="tl-btn tl-btn-ghost tl-btn-icon"
          onClick={handleOpenSettings}
          aria-label="Open settings"
        >
          <Icon name="settings" size={13} />
        </button>
      </header>

      {/* Toast banner */}
      <Banner banner={banner} />

      {/* Current-page card + save action */}
      <div className="tl-pp-now">
        {activeTab && <PageCard tab={activeTab} />}
        <div className="tl-pp-now-actions">
          <button
            className="tl-btn tl-btn-primary tl-btn-block"
            onClick={() => void handleSaveSession()}
            disabled={saving}
            aria-busy={saving}
          >
            <Icon name="plus" size={12} />
            {saving ? "Saving…" : "Save current session"}
          </button>
          {autoGroupEnabled && (
            <button
              className="tl-btn tl-btn-ghost tl-btn-block"
              onClick={() => void handleAutoGroup()}
              disabled={grouping}
              aria-busy={grouping}
            >
              <Icon name="layers" size={12} />
              {grouping ? "Grouping…" : "Auto-Group Tabs"}
            </button>
          )}
        </div>
      </div>

      {/* Recent collections section */}
      <div className="tl-pp-section">
        <span className="tl-pp-section-label">Or add to…</span>
      </div>

      <div className="tl-pp-list">
        {loading ? (
          <div className="tl-pp-loading" aria-busy="true" />
        ) : recentCollections.length === 0 ? (
          <EmptyState
            title="No collections yet"
            description="Save a session to get started."
          />
        ) : (
          <div role="list" aria-label="Recent collections">
            {recentCollections.map(({ collection: c, groupColor }) => (
              <RecentCollectionRow
                key={c.id}
                collection={c}
                groupColor={groupColor}
                onClick={() => void handleAddToCollection(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* New collection inline input */}
      <div className="tl-pp-new">
        <input
          ref={newCollInputRef}
          value={newCollName}
          onChange={(e) => setNewCollName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void handleNewCollSave()}
          placeholder="+ New collection…"
          aria-label="New collection name"
        />
        <button
          className="tl-btn tl-btn-secondary"
          disabled={!newCollName.trim()}
          onClick={() => void handleNewCollSave()}
        >
          Save
        </button>
      </div>

      {/* Footer */}
      <footer className="tl-pp-foot">
        <span className="tl-pp-foot-kbd">
          <kbd>⌘</kbd>
          <kbd>⇧</kbd>
          <kbd>S</kbd>
          <span style={{ marginLeft: 6 }}>quick save</span>
        </span>
        <button
          className="tl-btn tl-btn-ghost"
          style={{ height: "auto", padding: 0, fontSize: 11 }}
          onClick={handleOpenWorkspace}
          aria-label="Open workspace in new tab"
        >
          Open workspace <Icon name="external" size={11} />
        </button>
      </footer>
    </div>
  );
}
