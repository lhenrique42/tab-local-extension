import { useState } from "react";
import { Icon, EmptyState } from "../shared";
import { useStorage } from "../../lib/hooks/useStorage";
import { sendToBackground } from "../../lib/messaging/client";
import { createTab } from "../../lib/chrome/tabs";
import type { SavedCollection } from "../../lib/storage/schema";

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
/*  Recent collection row                                               */
/* ------------------------------------------------------------------ */

interface RecentCollectionRowProps {
  collection: SavedCollection;
}

function RecentCollectionRow({ collection }: RecentCollectionRowProps) {
  const tabCount = collection.tabs.length;
  return (
    <div className="tl-pp-coll" role="listitem">
      <span
        className="tl-pp-coll-dot"
        style={{
          background: collection.chromeGroupColor
            ? `var(--color-${collection.chromeGroupColor})`
            : "var(--fg-tertiary)",
        }}
        aria-hidden="true"
      />
      <span className="tl-pp-coll-name">{collection.name}</span>
      <span className="tl-pp-coll-count">{tabCount}</span>
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

interface BannerProps {
  banner: BannerState;
}

function Banner({ banner }: BannerProps) {
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
/*  Main Popup component                                                */
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

  const autoGroupEnabled = root.settings.autoGroupByDomainEnabled;

  // Sort collections by createdAt descending, take 3
  const recentCollections: SavedCollection[] = Object.values(root.collections)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);

  async function handleSaveSession() {
    setSaving(true);
    const name = buildDefaultName();
    const response = await sendToBackground({
      type: "SAVE_WINDOW",
      payload: { collectionName: name },
    });
    setSaving(false);

    if (response.ok) {
      setBanner({ kind: "success", name });
    } else {
      setBanner({ kind: "error", message: response.error });
    }

    setTimeout(() => setBanner(null), 2000);
  }

  function handleOpenWorkspace() {
    void createTab("chrome://newtab");
    window.close();
  }

  async function handleAutoGroup() {
    setGrouping(true);
    const response = await sendToBackground({
      type: "AUTO_GROUP_WINDOW",
      payload: {},
    });
    setGrouping(false);

    if (!response.ok) {
      setBanner({ kind: "error", message: response.error });
      setTimeout(() => setBanner(null), 2000);
    }
  }

  return (
    <div className="tl-popup" role="dialog" aria-label="TabLocal popup">
      {/* Header */}
      <header className="tl-pp-head">
        <span className="tl-pp-head-logo">
          <PopupLogo />
        </span>
        <span className="tl-pp-head-title">TabLocal</span>
        <span className="tl-pp-head-eyebrow">local</span>
      </header>

      {/* Toast banner */}
      <Banner banner={banner} />

      {/* Save session action */}
      <div className="tl-pp-now">
        <div className="tl-pp-now-actions">
          <button
            className="tl-btn tl-btn-primary tl-btn-block"
            onClick={handleSaveSession}
            disabled={saving}
            aria-busy={saving}
          >
            <Icon name="plus" size={12} />
            {saving ? "Saving…" : "Save current session"}
          </button>
          {autoGroupEnabled && (
            <button
              className="tl-btn tl-btn-ghost tl-btn-block"
              onClick={handleAutoGroup}
              disabled={grouping}
              aria-busy={grouping}
            >
              <Icon name="layers" size={12} />
              {grouping ? "Grouping…" : "Auto-Group Tabs"}
            </button>
          )}
        </div>
      </div>

      {/* Recent collections */}
      <div className="tl-pp-section">
        <span className="tl-pp-section-label">Recent collections</span>
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
            {recentCollections.map((c) => (
              <RecentCollectionRow key={c.id} collection={c} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="tl-pp-foot">
        <span className="tl-pp-foot-kbd">
          <kbd>⌘</kbd>
          <kbd>D</kbd>
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
