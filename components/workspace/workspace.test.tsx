import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook, act } from "@testing-library/react";
import { fakeBrowser } from "@webext-core/fake-browser";
import type {
  StorageRoot,
  SavedGroup,
  SavedCollection,
  SavedTab,
} from "../../lib/storage/schema";
import { defaultRoot } from "../../lib/storage/defaults";
import { useStorage } from "../../lib/hooks/useStorage";
import { Workspace } from "./Workspace";
import { GroupSection } from "./GroupSection";
import { CollectionCard } from "./CollectionCard";
import { TabList } from "./TabList";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
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

function makeCollection(
  overrides: Partial<SavedCollection> = {},
): SavedCollection {
  return {
    id: "c1",
    name: "My Collection",
    groupId: "g1",
    chromeGroupColor: "blue",
    tabs: [
      makeTab(),
      makeTab({ id: "t2", title: "Second tab", url: "https://second.com" }),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeGroup(overrides: Partial<SavedGroup> = {}): SavedGroup {
  return {
    id: "g1",
    name: "Work",
    color: "blue",
    collectionIds: ["c1"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeRoot(overrides: Partial<StorageRoot> = {}): StorageRoot {
  const collection = makeCollection();
  const group = makeGroup();
  return {
    ...defaultRoot(),
    groups: { g1: group },
    collections: { c1: collection },
    ...overrides,
  };
}

// Mock messaging and chrome adapters used by Header/Workspace
const mockSendToBackground = vi.fn();
vi.mock("../../lib/messaging/client", () => ({
  sendToBackground: (...args: unknown[]) => mockSendToBackground(...args),
}));
vi.mock("../../lib/chrome/tabs", () => ({
  createTab: vi.fn(),
  getCurrentWindowTabs: vi.fn().mockResolvedValue([]),
}));

// Wire fake chrome before each test
beforeEach(async () => {
  await fakeBrowser.storage.local.clear();
  vi.stubGlobal("chrome", fakeBrowser);
  mockSendToBackground.mockResolvedValue({ ok: true });
});

// -------------------------------------------------------------------
// useStorage hook
// -------------------------------------------------------------------
describe("useStorage", () => {
  it("returns loading=true initially then loading=false after first value", async () => {
    const { result } = renderHook(() => useStorage());
    // Initially loading
    expect(result.current[1]).toBe(true);
    // After storage reads, loading becomes false
    await waitFor(() => expect(result.current[1]).toBe(false));
  });

  it("returns defaultRoot() when storage is empty", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const { result } = renderHook(() => useStorage());
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current[1]).toBe(false);
    expect(result.current[0]).toEqual(defaultRoot());
    vi.useRealTimers();
  });

  it("updates state when storage changes externally", async () => {
    const { result } = renderHook(() => useStorage());
    await waitFor(() => expect(result.current[1]).toBe(false));

    const newRoot = makeRoot();
    await act(async () => {
      await fakeBrowser.storage.local.set({ __tablocal_root: newRoot });
    });

    await waitFor(() =>
      expect(result.current[0].groups["g1"]?.name).toBe("Work"),
    );
  });
});

// -------------------------------------------------------------------
// Workspace
// -------------------------------------------------------------------
describe("Workspace", () => {
  it("renders empty state when root has zero groups", () => {
    const emptyRoot: StorageRoot = { ...defaultRoot(), groups: {}, groupOrder: [] };
    render(<Workspace root={emptyRoot} loading={false} />);
    expect(screen.getByText("No collections yet")).toBeInTheDocument();
  });

  it("renders a GroupSection for each group in the root", () => {
    const root = makeRoot({
      groups: {
        g1: makeGroup({ id: "g1", name: "Group One", collectionIds: ["c1"] }),
        g2: makeGroup({ id: "g2", name: "Group Two", collectionIds: [] }),
      },
      collections: { c1: makeCollection({ id: "c1", groupId: "g1" }) },
    });
    render(<Workspace root={root} loading={false} />);
    expect(screen.getByRole("heading", { level: 2, name: "Group One" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Group Two" })).toBeInTheDocument();
  });

  it("renders loading state when loading=true", () => {
    render(<Workspace root={defaultRoot()} loading={true} />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  });

  it("renders the header with logo", () => {
    render(<Workspace root={defaultRoot()} loading={false} />);
    expect(screen.getAllByRole("banner")[0]).toBeInTheDocument();
    expect(screen.getByLabelText("TabLocal")).toBeInTheDocument();
  });

  it("renders stats in the header", () => {
    const root = makeRoot();
    render(<Workspace root={root} loading={false} />);
    expect(screen.getByLabelText("Search tabs and collections")).toBeInTheDocument();
  });

  it("filters groups by search query", async () => {
    const root = makeRoot({
      groups: {
        g1: makeGroup({ id: "g1", name: "Work", collectionIds: ["c1"] }),
        g2: makeGroup({ id: "g2", name: "Personal", collectionIds: ["c2"] }),
      },
      collections: {
        c1: makeCollection({ id: "c1", name: "Sprint docs", groupId: "g1" }),
        c2: makeCollection({ id: "c2", name: "Reading list", groupId: "g2" }),
      },
    });
    render(<Workspace root={root} loading={false} />);

    const searchInput = screen.getByLabelText("Search tabs and collections");
    await userEvent.type(searchInput, "Sprint");

    expect(screen.getByRole("heading", { level: 2, name: "Work" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Personal" })).not.toBeInTheDocument();
  });
});

// -------------------------------------------------------------------
// GroupSection
// -------------------------------------------------------------------
describe("GroupSection", () => {
  const noopHandlers = {
    onNewCollection: vi.fn(),
    onRenameGroup: vi.fn(),
    onDeleteGroup: vi.fn(),
    onRenameCollection: vi.fn(),
    onDeleteCollection: vi.fn(),
    onAddTab: vi.fn(),
    onRemoveTab: vi.fn(),
    onDuplicateTab: vi.fn(),
    onReorderCollections: vi.fn(),
    onReorderTabs: vi.fn(),
    onRestore: vi.fn().mockResolvedValue(undefined),
  };

  it("renders the group name", () => {
    const group = makeGroup({ name: "Research" });
    render(<GroupSection group={group} collections={[]} {...noopHandlers} />);
    expect(screen.getByText("Research")).toBeInTheDocument();
  });

  it("renders correct number of CollectionCard elements", () => {
    const group = makeGroup({ collectionIds: ["c1", "c2"] });
    const collections = [
      makeCollection({ id: "c1", name: "Alpha" }),
      makeCollection({ id: "c2", name: "Beta" }),
    ];
    render(
      <GroupSection
        group={group}
        collections={collections}
        {...noopHandlers}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 3, name: "Alpha" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Beta" }),
    ).toBeInTheDocument();
  });

  it("shows empty message when group has no collections", () => {
    const group = makeGroup({ collectionIds: [] });
    render(<GroupSection group={group} collections={[]} {...noopHandlers} />);
    expect(
      screen.getByText(/no collections in this group/i),
    ).toBeInTheDocument();
  });

  it("toggles collapsed state when header is clicked", () => {
    const group = makeGroup({ name: "Toggle Me", collectionIds: ["c1"] });
    const collections = [makeCollection({ id: "c1", name: "Visible" })];
    render(
      <GroupSection
        group={group}
        collections={collections}
        {...noopHandlers}
      />,
    );
    // Visible initially (use heading to avoid duplicate match with footer)
    expect(
      screen.getByRole("heading", { level: 3, name: "Visible" }),
    ).toBeInTheDocument();
    // Click the chevron button to collapse
    fireEvent.click(screen.getByRole("button", { name: "Collapse group" }));
    expect(
      screen.queryByRole("heading", { level: 3, name: "Visible" }),
    ).not.toBeInTheDocument();
  });
});

// -------------------------------------------------------------------
// CollectionCard
// -------------------------------------------------------------------
describe("CollectionCard", () => {
  const noopCollectionHandlers = {
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onAddTab: vi.fn(),
    onRemoveTab: vi.fn(),
    onReorderTabs: vi.fn(),
    onRestore: vi.fn().mockResolvedValue(undefined),
    onDuplicateTab: vi.fn(),
  };

  it("renders collection name and tab count badge", () => {
    const collection = makeCollection({
      name: "Sprint Planning",
      tabs: [makeTab(), makeTab({ id: "t2" })],
    });
    render(
      <CollectionCard collection={collection} {...noopCollectionHandlers} />,
    );
    expect(
      screen.getByRole("heading", { level: 3, name: "Sprint Planning" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 tabs")).toBeInTheDocument();
  });

  it("expands TabList when card is clicked", async () => {
    const collection = makeCollection({
      name: "Expandable",
      tabs: [makeTab({ title: "My Expanded Tab", url: "https://expand.com" })],
    });
    render(
      <CollectionCard collection={collection} {...noopCollectionHandlers} />,
    );
    fireEvent.click(screen.getByRole("article"));
    await waitFor(() =>
      expect(screen.getByText("My Expanded Tab")).toBeInTheDocument(),
    );
  });

  it("shows EmptyState for a collection with 0 tabs", () => {
    const collection = makeCollection({ tabs: [] });
    render(
      <CollectionCard collection={collection} {...noopCollectionHandlers} />,
    );
    expect(screen.getByText("No tabs")).toBeInTheDocument();
  });

  it("shows preview items when collapsed", () => {
    const tabs = Array.from({ length: 6 }, (_, i) =>
      makeTab({ id: `t${i}`, title: `Tab ${i}`, url: `https://tab${i}.com` }),
    );
    const collection = makeCollection({ tabs });
    render(
      <CollectionCard collection={collection} {...noopCollectionHandlers} />,
    );
    // Should show max 4 preview + "+2 more"
    expect(screen.getByText("+ 2 more")).toBeInTheDocument();
  });

  it("renders a Restore button", () => {
    const collection = makeCollection();
    render(
      <CollectionCard collection={collection} {...noopCollectionHandlers} />,
    );
    expect(
      screen.getByRole("button", { name: "Restore collection" }),
    ).toBeInTheDocument();
  });

  it("calls onRestore with collectionId when Restore button is clicked", async () => {
    const onRestore = vi.fn().mockResolvedValue(undefined);
    const collection = makeCollection();
    render(
      <CollectionCard
        collection={collection}
        {...noopCollectionHandlers}
        onRestore={onRestore}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Restore collection" }),
    );
    expect(onRestore).toHaveBeenCalledWith(collection.id);
  });
});

// -------------------------------------------------------------------
// TabList
// -------------------------------------------------------------------
describe("TabList", () => {
  it("renders correct number of tab rows", () => {
    const tabs = [
      makeTab({ id: "t1", title: "Tab One", url: "https://one.com" }),
      makeTab({ id: "t2", title: "Tab Two", url: "https://two.com" }),
      makeTab({ id: "t3", title: "Tab Three", url: "https://three.com" }),
    ];
    render(<TabList tabs={tabs} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("renders tab titles", () => {
    const tabs = [
      makeTab({ id: "t1", title: "Hello World", url: "https://hello.com" }),
    ];
    render(<TabList tabs={tabs} />);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("renders hostname from URL", () => {
    const tabs = [
      makeTab({ id: "t1", title: "Example", url: "https://example.com/path" }),
    ];
    render(<TabList tabs={tabs} />);
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });
});
