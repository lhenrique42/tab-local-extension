import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBrowser } from "@webext-core/fake-browser";
import { Popup } from "./Popup";
import type { StorageRoot } from "../../lib/storage/schema";
import { defaultRoot } from "../../lib/storage/defaults";

/* ------------------------------------------------------------------ */
/*  Module mocks                                                        */
/* ------------------------------------------------------------------ */

const mockSendToBackground = vi.fn();
const mockCreateTab = vi.fn();
const mockUseStorage = vi.fn();
const mockGetCurrentWindowTabs = vi.fn();
const mockStoragePatch = vi.fn();

vi.mock("../../lib/messaging/client", () => ({
  sendToBackground: (...args: unknown[]) => mockSendToBackground(...args),
}));

vi.mock("../../lib/chrome/tabs", () => ({
  createTab: (...args: unknown[]) => mockCreateTab(...args),
  getCurrentWindowTabs: () => mockGetCurrentWindowTabs(),
}));

vi.mock("../../lib/hooks/useStorage", () => ({
  useStorage: () => mockUseStorage(),
}));

vi.mock("../../lib/storage/adapter", () => ({
  storage: { patch: (...args: unknown[]) => mockStoragePatch(...args) },
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeCollection(
  id: string,
  name: string,
  createdAt: number,
  tabCount = 3,
): StorageRoot["collections"][string] {
  return {
    id,
    name,
    groupId: null,
    chromeGroupColor: null,
    tabs: Array.from({ length: tabCount }, (_, i) => ({
      id: `${id}-t${i}`,
      url: `https://example.com/${i}`,
      title: `Tab ${i}`,
      faviconUrl: null,
      addedAt: createdAt + i,
    })),
    createdAt,
    updatedAt: createdAt,
  };
}

function makeRoot(collections: StorageRoot["collections"] = {}): StorageRoot {
  return { ...defaultRoot(), collections };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateTab.mockResolvedValue({});
  mockSendToBackground.mockResolvedValue({ ok: true, data: null });
  mockUseStorage.mockReturnValue([makeRoot(), false]);
  mockGetCurrentWindowTabs.mockResolvedValue([]);
  mockStoragePatch.mockResolvedValue(undefined);
  vi.stubGlobal("close", vi.fn());
});

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("Popup", () => {
  it("renders the save session button", () => {
    render(<Popup />);
    expect(
      screen.getByRole("button", { name: /save current session/i }),
    ).toBeInTheDocument();
  });

  it("renders up to 3 most recent collections", async () => {
    const collections = {
      c1: makeCollection("c1", "Alpha", 1000),
      c2: makeCollection("c2", "Beta", 3000),
      c3: makeCollection("c3", "Gamma", 2000),
      c4: makeCollection("c4", "Delta", 4000),
    };
    mockUseStorage.mockReturnValue([makeRoot(collections), false]);

    render(<Popup />);

    // Newest 3: Delta (4000), Beta (3000), Gamma (2000) — Alpha dropped
    expect(screen.getByText("Delta")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });

  it("renders EmptyState when storage has no collections", () => {
    render(<Popup />);
    expect(screen.getByText("No collections yet")).toBeInTheDocument();
  });

  it("calls sendToBackground with SAVE_WINDOW on save button click", async () => {
    render(<Popup />);

    await userEvent.click(
      screen.getByRole("button", { name: /save current session/i }),
    );

    await waitFor(() => expect(mockSendToBackground).toHaveBeenCalledOnce());
    expect(mockSendToBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SAVE_WINDOW",
        payload: expect.objectContaining({
          collectionName: expect.any(String),
        }),
      }),
    );
  });

  it("shows success toast when SAVE_WINDOW succeeds", async () => {
    mockSendToBackground.mockResolvedValueOnce({ ok: true, data: null });

    render(<Popup />);
    await userEvent.click(
      screen.getByRole("button", { name: /save current session/i }),
    );

    await waitFor(() =>
      expect(screen.getByText(/saved as/i)).toBeInTheDocument(),
    );
  });

  it("shows error message when SAVE_WINDOW returns error", async () => {
    mockSendToBackground.mockResolvedValueOnce({
      ok: false,
      error: "Background SW error",
    });

    render(<Popup />);
    await userEvent.click(
      screen.getByRole("button", { name: /save current session/i }),
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("Background SW error");
  });

  it("sorts collections by createdAt descending", () => {
    const collections = {
      c1: makeCollection("c1", "Oldest", 100),
      c2: makeCollection("c2", "Newest", 900),
      c3: makeCollection("c3", "Middle", 500),
    };
    mockUseStorage.mockReturnValue([makeRoot(collections), false]);

    const { container } = render(<Popup />);

    const rows = Array.from(container.querySelectorAll(".tl-pp-coll"));
    const names = rows.map((r) => r.querySelector(".tl-pp-coll-name")?.textContent);
    expect(names).toEqual(["Newest", "Middle", "Oldest"]);
  });

  it("shows tab count in eyebrow when window tabs are loaded", async () => {
    mockGetCurrentWindowTabs.mockResolvedValueOnce([
      { id: 1, url: "https://example.com", title: "Example", faviconUrl: null, windowId: 1, active: true },
      { id: 2, url: "https://github.com", title: "GitHub", faviconUrl: null, windowId: 1, active: false },
    ]);

    render(<Popup />);
    await act(async () => {});

    expect(screen.getByText(/local · 2/i)).toBeInTheDocument();
  });

  it("shows active tab card when window has an active tab", async () => {
    mockGetCurrentWindowTabs.mockResolvedValueOnce([
      { id: 1, url: "https://news.ycombinator.com/item?id=1", title: "Hacker News", faviconUrl: null, windowId: 1, active: true },
    ]);

    render(<Popup />);
    await act(async () => {});

    expect(screen.getByText("Hacker News")).toBeInTheDocument();
    expect(screen.getByText("news.ycombinator.com")).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────
// Auto-Group Tabs button
// ──────────────────────────────────────────────

describe("Popup — Auto-Group Tabs button", () => {
  it("is hidden when autoGroupByDomainEnabled is false", () => {
    const root = makeRoot();
    root.settings.autoGroupByDomainEnabled = false;
    mockUseStorage.mockReturnValue([root, false]);

    render(<Popup />);
    expect(
      screen.queryByRole("button", { name: /auto-group tabs/i }),
    ).not.toBeInTheDocument();
  });

  it("is visible when autoGroupByDomainEnabled is true", () => {
    const root = makeRoot();
    root.settings.autoGroupByDomainEnabled = true;
    mockUseStorage.mockReturnValue([root, false]);

    render(<Popup />);
    expect(
      screen.getByRole("button", { name: /auto-group tabs/i }),
    ).toBeInTheDocument();
  });

  it("sends AUTO_GROUP_WINDOW message when clicked", async () => {
    const root = makeRoot();
    root.settings.autoGroupByDomainEnabled = true;
    mockUseStorage.mockReturnValue([root, false]);
    mockSendToBackground.mockResolvedValueOnce({
      ok: true,
      data: { groupCount: 2 },
    });

    render(<Popup />);
    await userEvent.click(
      screen.getByRole("button", { name: /auto-group tabs/i }),
    );

    await waitFor(() =>
      expect(mockSendToBackground).toHaveBeenCalledWith(
        expect.objectContaining({ type: "AUTO_GROUP_WINDOW" }),
      ),
    );
  });

  it("shows error banner when AUTO_GROUP_WINDOW returns error", async () => {
    const root = makeRoot();
    root.settings.autoGroupByDomainEnabled = true;
    mockUseStorage.mockReturnValue([root, false]);
    mockSendToBackground.mockResolvedValueOnce({
      ok: false,
      error: "Tab groups unavailable",
    });

    render(<Popup />);
    await userEvent.click(
      screen.getByRole("button", { name: /auto-group tabs/i }),
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Tab groups unavailable",
    );
  });
});

// ──────────────────────────────────────────────
// New collection inline input
// ──────────────────────────────────────────────

describe("Popup — New collection input", () => {
  it("renders the new collection input", () => {
    render(<Popup />);
    expect(
      screen.getByPlaceholderText(/\+ new collection/i),
    ).toBeInTheDocument();
  });

  it("creates a collection and shows toast on Save click", async () => {
    render(<Popup />);

    const input = screen.getByPlaceholderText(/\+ new collection/i);
    await userEvent.type(input, "My New Collection");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(mockStoragePatch).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByText(/saved as/i)).toBeInTheDocument(),
    );
  });

  it("creates a collection on Enter key", async () => {
    render(<Popup />);

    const input = screen.getByPlaceholderText(/\+ new collection/i);
    await userEvent.type(input, "Keyboard Collection{Enter}");

    await waitFor(() => expect(mockStoragePatch).toHaveBeenCalledOnce());
  });

  it("Save button is disabled when input is empty", () => {
    render(<Popup />);
    const saveBtn = screen.getByRole("button", { name: /^save$/i });
    expect(saveBtn).toBeDisabled();
  });
});

// ──────────────────────────────────────────────
// Open Settings link
// ──────────────────────────────────────────────

describe("Popup — Open Settings link", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", {
      ...fakeBrowser,
      runtime: {
        ...fakeBrowser.runtime,
        getURL: (path: string) => `chrome-extension://test/${path}`,
      },
    });
  });

  it("renders an Open Settings button in the header", () => {
    render(<Popup />);
    expect(
      screen.getByRole("button", { name: /open settings/i }),
    ).toBeInTheDocument();
  });

  it("opens settings in-popup (shows settings heading, not a new tab)", async () => {
    render(<Popup />);
    await userEvent.click(
      screen.getByRole("button", { name: /open settings/i }),
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument(),
    );
    expect(mockCreateTab).not.toHaveBeenCalledWith(
      expect.stringContaining("settings.html"),
    );
  });
});
