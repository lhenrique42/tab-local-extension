import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook } from "@testing-library/react";
import { LiveTabsSidebar } from "./LiveTabsSidebar";
import { useLiveTabs } from "../../lib/hooks/useLiveTabs";
import type { TabInfo } from "../../lib/chrome/tabs";

/* ------------------------------------------------------------------ */
/*  Mock getCurrentWindowTabs                                           */
/* ------------------------------------------------------------------ */

const mockGetCurrentWindowTabs = vi.fn();
const mockSendToBackground = vi.fn();
const mockGetStorageUsage = vi.fn().mockResolvedValue({ usedBytes: 0, quotaBytes: 5 * 1024 * 1024 });

vi.mock("../../lib/chrome/tabs", () => ({
  getCurrentWindowTabs: () => mockGetCurrentWindowTabs(),
}));

vi.mock("../../lib/messaging/client", () => ({
  sendToBackground: (...args: unknown[]) => mockSendToBackground(...args),
}));

vi.mock("../../lib/chrome/storage", () => ({
  getStorageUsage: () => mockGetStorageUsage(),
}));

/* ------------------------------------------------------------------ */
/*  Chrome events helpers                                               */
/* ------------------------------------------------------------------ */

function makeEventSource() {
  const listeners = new Set<(...args: unknown[]) => void>();
  return {
    addListener: (fn: (...args: unknown[]) => void) => listeners.add(fn),
    removeListener: (fn: (...args: unknown[]) => void) => listeners.delete(fn),
    fire: (...args: unknown[]) => listeners.forEach((fn) => fn(...args)),
  };
}

let onCreated: ReturnType<typeof makeEventSource>;
let onRemoved: ReturnType<typeof makeEventSource>;
let onUpdated: ReturnType<typeof makeEventSource>;
let onActivated: ReturnType<typeof makeEventSource>;

beforeEach(() => {
  onCreated = makeEventSource();
  onRemoved = makeEventSource();
  onUpdated = makeEventSource();
  onActivated = makeEventSource();

  globalThis.chrome = {
    tabs: { onCreated, onRemoved, onUpdated, onActivated },
  } as unknown as typeof chrome;

  mockGetCurrentWindowTabs.mockResolvedValue([]);
  mockSendToBackground.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

/* ------------------------------------------------------------------ */
/*  Sample data                                                         */
/* ------------------------------------------------------------------ */

const sampleTabs: TabInfo[] = [
  {
    id: 1,
    url: "https://example.com",
    title: "Example",
    faviconUrl: "",
    windowId: 1,
    active: true,
  },
  {
    id: 2,
    url: "https://github.com",
    title: "GitHub",
    faviconUrl: "",
    windowId: 1,
    active: false,
  },
];

/* ------------------------------------------------------------------ */
/*  useLiveTabs                                                         */
/* ------------------------------------------------------------------ */

describe("useLiveTabs", () => {
  it("returns tabs from initial query", async () => {
    mockGetCurrentWindowTabs.mockResolvedValueOnce(sampleTabs);
    const { result } = renderHook(() => useLiveTabs());
    await act(async () => {});
    expect(result.current).toHaveLength(2);
    expect(result.current[0].title).toBe("Example");
  });

  it("re-queries when onCreated fires", async () => {
    const extra: TabInfo = {
      id: 3,
      url: "https://new.io",
      title: "New",
      faviconUrl: "",
      windowId: 1,
      active: false,
    };
    mockGetCurrentWindowTabs
      .mockResolvedValueOnce(sampleTabs)
      .mockResolvedValueOnce([...sampleTabs, extra]);
    const { result } = renderHook(() => useLiveTabs());
    await act(async () => {});
    expect(result.current).toHaveLength(2);
    await act(async () => {
      onCreated.fire({});
    });
    expect(result.current).toHaveLength(3);
  });

  it("re-queries when onRemoved fires", async () => {
    mockGetCurrentWindowTabs
      .mockResolvedValueOnce(sampleTabs)
      .mockResolvedValueOnce([sampleTabs[0]]);
    const { result } = renderHook(() => useLiveTabs());
    await act(async () => {});
    expect(result.current).toHaveLength(2);
    await act(async () => {
      onRemoved.fire(2);
    });
    expect(result.current).toHaveLength(1);
  });

  it("removes all listeners on unmount", async () => {
    const removeCreated = vi.spyOn(onCreated, "removeListener");
    const { unmount } = renderHook(() => useLiveTabs());
    await act(async () => {});
    unmount();
    expect(removeCreated).toHaveBeenCalledOnce();
  });
});

/* ------------------------------------------------------------------ */
/*  LiveTabsSidebar component                                           */
/* ------------------------------------------------------------------ */

describe("LiveTabsSidebar", () => {
  it("renders one row per tab", async () => {
    mockGetCurrentWindowTabs.mockResolvedValueOnce(sampleTabs);
    render(<LiveTabsSidebar onToggle={vi.fn()} />);
    await act(async () => {});
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows EmptyState when no tabs are open", async () => {
    mockGetCurrentWindowTabs.mockResolvedValueOnce([]);
    render(<LiveTabsSidebar onToggle={vi.fn()} />);
    await act(async () => {});
    expect(screen.getByText("No tabs")).toBeInTheDocument();
  });

  it("calls onToggle when hide button is clicked", async () => {
    mockGetCurrentWindowTabs.mockResolvedValueOnce(sampleTabs);
    const onToggle = vi.fn();
    render(<LiveTabsSidebar onToggle={onToggle} />);
    await act(async () => {});
    await userEvent.click(screen.getByRole("button", { name: "Hide sidebar" }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("marks the active tab row with is-active class", async () => {
    mockGetCurrentWindowTabs.mockResolvedValueOnce(sampleTabs);
    render(<LiveTabsSidebar onToggle={vi.fn()} />);
    await act(async () => {});
    const rows = screen.getAllByRole("listitem");
    expect(rows[0].className).toContain("is-active");
    expect(rows[1].className).not.toContain("is-active");
  });

  it("renders the Save all as collection button", async () => {
    mockGetCurrentWindowTabs.mockResolvedValueOnce(sampleTabs);
    render(<LiveTabsSidebar onToggle={vi.fn()} />);
    await act(async () => {});
    expect(
      screen.getByRole("button", { name: /save all as collection/i }),
    ).toBeInTheDocument();
  });

  it("calls sendToBackground with SAVE_WINDOW when Save all is clicked", async () => {
    mockGetCurrentWindowTabs.mockResolvedValueOnce(sampleTabs);
    render(<LiveTabsSidebar onToggle={vi.fn()} />);
    await act(async () => {});

    await userEvent.click(
      screen.getByRole("button", { name: /save all as collection/i }),
    );

    await waitFor(() =>
      expect(mockSendToBackground).toHaveBeenCalledWith(
        expect.objectContaining({ type: "SAVE_WINDOW" }),
      ),
    );
  });

  it("renders the storage meter", async () => {
    mockGetCurrentWindowTabs.mockResolvedValueOnce([]);
    render(<LiveTabsSidebar onToggle={vi.fn()} />);
    await act(async () => {});
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
