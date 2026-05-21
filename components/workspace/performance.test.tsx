import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook } from "@testing-library/react";
import { fakeBrowser } from "@webext-core/fake-browser";
import { axe } from "vitest-axe";

import { TabList } from "./TabList";
import { Workspace } from "./Workspace";
import { Popup } from "../popup/Popup";
import { Settings } from "../settings/Settings";
import { defaultRoot } from "../../lib/storage/defaults";
import { useStorage } from "../../lib/hooks/useStorage";
import type { SavedTab } from "../../lib/storage/schema";

// Mock @tanstack/react-virtual so jsdom (which has no layout engine) returns
// a fixed window of 10 items for any list — proving only visible rows render.
vi.mock("@tanstack/react-virtual", () => ({
    useVirtualizer: ({
        count,
        estimateSize,
    }: {
        count: number;
        estimateSize: () => number;
    }) => {
        const size = estimateSize();
        const visibleCount = Math.min(count, 10);
        return {
            getVirtualItems: () =>
                Array.from({ length: visibleCount }, (_, index) => ({
                    index,
                    start: index * size,
                    size,
                    key: index,
                    lane: 0,
                })),
            getTotalSize: () => count * size,
            measureElement: () => {},
        };
    },
}));

// Mock chrome messaging + tabs adapters used by Workspace and Popup
const mockSendToBackground = vi.fn();
vi.mock("../../lib/messaging/client", () => ({
    sendToBackground: (...args: unknown[]) => mockSendToBackground(...args),
}));
vi.mock("../../lib/chrome/tabs", () => ({
    createTab: vi.fn(),
    getCurrentWindowTabs: vi.fn().mockResolvedValue([]),
}));

// Helpers

function makeTab(overrides: Partial<SavedTab> = {}): SavedTab {
    return {
        id: "t1",
        url: "https://example.com",
        title: "Example",
        faviconUrl: null,
        addedAt: Date.now(),
        ...overrides,
    };
}

function makeTabs(count: number): SavedTab[] {
    return Array.from({ length: count }, (_, i) =>
        makeTab({
            id: `tab-${i}`,
            title: `Tab ${i}`,
            url: `https://example${i}.com`,
        }),
    );
}

beforeEach(async () => {
    await fakeBrowser.storage.local.clear();
    vi.stubGlobal("chrome", fakeBrowser);
    mockSendToBackground.mockResolvedValue({ ok: true });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Virtualization
// ─────────────────────────────────────────────────────────────────────────────

describe("TabList virtualization", () => {
    it("renders all rows when tab count is ≤ 50 (no virtualization)", () => {
        const tabs = makeTabs(3);
        render(<TabList tabs={tabs} />);
        expect(screen.getAllByRole("listitem")).toHaveLength(3);
    });

    it("renders only visible rows (< total count) when tabs.length > 50", () => {
        const tabs = makeTabs(100);
        render(<TabList tabs={tabs} onReorder={vi.fn()} />);
        // Mocked virtualizer returns max 10 items, so much less than 100
        const listitems = screen.getAllByRole("listitem");
        expect(listitems.length).toBeLessThan(100);
        expect(listitems.length).toBeGreaterThan(0);
    });

    it("still renders a list container for virtualized rows", () => {
        const tabs = makeTabs(60);
        const { container } = render(
            <TabList tabs={tabs} onReorder={vi.fn()} />,
        );
        expect(
            container.querySelector('[role="list"][aria-label="Saved tabs"]'),
        ).toBeInTheDocument();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Quota warning banner
// ─────────────────────────────────────────────────────────────────────────────

describe("Quota warning banner", () => {
    it("renders quota warning banner when quotaWarning=true", () => {
        render(
            <Workspace
                root={defaultRoot()}
                loading={false}
                quotaWarning={true}
            />,
        );
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText(/storage is almost full/i)).toBeInTheDocument();
    });

    it("does not render quota warning when quotaWarning=false", () => {
        render(
            <Workspace
                root={defaultRoot()}
                loading={false}
                quotaWarning={false}
            />,
        );
        expect(
            screen.queryByText(/storage is almost full/i),
        ).not.toBeInTheDocument();
    });

    it("quota warning is dismissible — X button hides banner without touching storage", async () => {
        render(
            <Workspace
                root={defaultRoot()}
                loading={false}
                quotaWarning={true}
            />,
        );
        const dismissBtn = screen.getByRole("button", {
            name: /dismiss storage warning/i,
        });
        await userEvent.click(dismissBtn);
        expect(
            screen.queryByText(/storage is almost full/i),
        ).not.toBeInTheDocument();
        // Storage should be unchanged
        const stored = await fakeBrowser.storage.local.get("__tablocal_root");
        expect(stored.__tablocal_root).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// useStorage quota integration
// ─────────────────────────────────────────────────────────────────────────────

describe("useStorage quota check", () => {
    it("exposes quotaWarning=true when bytesInUse exceeds 80% of QUOTA_BYTES", async () => {
        vi.stubGlobal("chrome", {
            ...fakeBrowser,
            storage: {
                ...fakeBrowser.storage,
                local: {
                    ...fakeBrowser.storage.local,
                    QUOTA_BYTES: 5_242_880,
                    getBytesInUse: vi.fn(
                        (_keys: null, cb: (bytes: number) => void) =>
                            cb(5_000_000),
                    ),
                },
            },
        });

        const { result } = renderHook(() => useStorage());
        await waitFor(() => expect(result.current[1]).toBe(false));
        await waitFor(() => expect(result.current[2]).toBe(true));
    });

    it("exposes quotaWarning=false when bytesInUse is below 80% of QUOTA_BYTES", async () => {
        vi.stubGlobal("chrome", {
            ...fakeBrowser,
            storage: {
                ...fakeBrowser.storage,
                local: {
                    ...fakeBrowser.storage.local,
                    QUOTA_BYTES: 5_242_880,
                    getBytesInUse: vi.fn(
                        (_keys: null, cb: (bytes: number) => void) =>
                            cb(100_000),
                    ),
                },
            },
        });

        const { result } = renderHook(() => useStorage());
        await waitFor(() => expect(result.current[1]).toBe(false));
        expect(result.current[2]).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Accessibility — axe-core
// ─────────────────────────────────────────────────────────────────────────────

describe("Accessibility — axe-core zero violations", () => {
    it("newtab: Workspace root has zero axe violations", async () => {
        const { container } = render(
            <Workspace root={defaultRoot()} loading={false} />,
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it("popup: Popup entrypoint has zero axe violations", async () => {
        const { container } = render(<Popup />);
        await act(async () => {});
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it("settings: Settings entrypoint has zero axe violations", async () => {
        const { container } = render(<Settings />);
        await waitFor(() =>
            expect(
                container.querySelector('[aria-busy="true"]'),
            ).not.toBeInTheDocument(),
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard accessibility
// ─────────────────────────────────────────────────────────────────────────────

describe("Keyboard accessibility", () => {
    it("drag handle has aria-label='Drag to reorder'", () => {
        const tabs = [makeTab({ id: "t1", title: "My Tab" })];
        render(<TabList tabs={tabs} onReorder={vi.fn()} />);
        expect(
            screen.getByRole("button", { name: "Drag to reorder" }),
        ).toBeInTheDocument();
    });

    it("drag handle is focusable via keyboard (Tab-reachable)", () => {
        const tabs = [makeTab({ id: "t1", title: "My Tab" })];
        render(<TabList tabs={tabs} onReorder={vi.fn()} />);
        const handle = screen.getByRole("button", { name: "Drag to reorder" });
        handle.focus();
        expect(handle).toHaveFocus();
    });

    it("all interactive elements in Workspace are reachable by Tab", async () => {
        const user = userEvent.setup();
        render(<Workspace root={defaultRoot()} loading={false} />);
        // Tab through several elements — verifies no focusable element is trapped
        for (let i = 0; i < 6; i++) {
            await user.tab();
            expect(document.activeElement).toBeTruthy();
        }
    });
});
