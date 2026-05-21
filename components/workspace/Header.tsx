import type {} from "react";
import { Icon } from "../shared";

function LogoMark() {
    return (
        <svg
            width="22"
            height="22"
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

export interface HeaderProps {
    totalGroups: number;
    totalCollections: number;
    totalTabs: number;
    query: string;
    onQueryChange: (q: string) => void;
    onSaveSession: () => void;
    saving: boolean;
    onOpenSettings: () => void;
}

export function Header({
    totalGroups,
    totalCollections,
    totalTabs,
    query,
    onQueryChange,
    onSaveSession,
    saving,
    onOpenSettings,
}: HeaderProps) {
    return (
        <header className="tl-header">
            <div className="tl-header-left">
                <span className="tl-logo" aria-label="TabLocal">
                    <LogoMark />
                    <span className="tl-logo-word">
                        Tab<span className="tl-logo-word-light">Local</span>
                    </span>
                </span>
                <span className="tl-eyebrow">Stored on this device</span>
            </div>

            <div className="tl-header-search">
                <Icon name="search" size={14} aria-hidden />
                <input
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="Search tabs &amp; collections…"
                    spellCheck={false}
                    aria-label="Search tabs and collections"
                />
                <kbd aria-hidden="true">/</kbd>
            </div>

            <div className="tl-header-right">
                <span className="tl-stat">
                    <span className="tl-stat-num">{totalGroups}</span>
                    <span className="tl-stat-label">groups</span>
                </span>
                <span className="tl-stat-sep" aria-hidden="true">
                    ·
                </span>
                <span className="tl-stat">
                    <span className="tl-stat-num">{totalCollections}</span>
                    <span className="tl-stat-label">collections</span>
                </span>
                <span className="tl-stat-sep" aria-hidden="true">
                    ·
                </span>
                <span className="tl-stat">
                    <span className="tl-stat-num">
                        {totalTabs.toLocaleString()}
                    </span>
                    <span className="tl-stat-label">tabs</span>
                </span>

                <button
                    className="tl-btn tl-btn-primary"
                    onClick={onSaveSession}
                    disabled={saving}
                    aria-busy={saving}
                    aria-label="Save current session"
                >
                    <Icon name="save" size={14} aria-hidden />
                    {saving ? "Saving…" : "Save current session"}
                    <span className="tl-btn-shortcut" aria-hidden="true">
                        ⌘⇧S
                    </span>
                </button>

                <button
                    className="tl-btn tl-btn-ghost tl-btn-icon"
                    onClick={onOpenSettings}
                    aria-label="Open settings"
                >
                    <Icon name="settings" size={16} aria-hidden />
                </button>
            </div>
        </header>
    );
}
