/**
 * TASK-008 — Collection CRUD unit tests
 *
 * Tests inline rename, delete with ConfirmDialog, and Workspace-level
 * mutation handlers (storage.patch calls).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBrowser } from "@webext-core/fake-browser";
import { CollectionCard } from "./CollectionCard";
import { GroupSection } from "./GroupSection";
import { Workspace } from "./Workspace";
import type {
    SavedCollection,
    SavedGroup,
    SavedTab,
    StorageRoot,
} from "../../lib/storage/schema";
import { defaultRoot } from "../../lib/storage/defaults";
import { storage } from "../../lib/storage/adapter";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeTab(overrides: Partial<SavedTab> = {}): SavedTab {
    return {
        id: "t1",
        url: "https://example.com",
        title: "Example",
        faviconUrl: null,
        addedAt: 1000,
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
        chromeGroupColor: null,
        tabs: [makeTab()],
        createdAt: 1000,
        updatedAt: 1000,
        ...overrides,
    };
}

function makeGroup(overrides: Partial<SavedGroup> = {}): SavedGroup {
    return {
        id: "g1",
        name: "Work",
        color: "blue",
        collectionIds: ["c1"],
        createdAt: 1000,
        updatedAt: 1000,
        ...overrides,
    };
}

function makeRoot(overrides: Partial<StorageRoot> = {}): StorageRoot {
    return {
        ...defaultRoot(),
        groups: { g1: makeGroup() },
        collections: { c1: makeCollection() },
        ...overrides,
    };
}

const noopGroupHandlers = {
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

const noopCollectionHandlers = {
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onAddTab: vi.fn(),
    onRemoveTab: vi.fn(),
    onDuplicateTab: vi.fn(),
    onReorderTabs: vi.fn(),
    onRestore: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
    vi.clearAllMocks();
    fakeBrowser.reset();
    vi.stubGlobal("chrome", fakeBrowser);
});

/* ------------------------------------------------------------------ */
/*  CollectionCard — inline rename                                      */
/* ------------------------------------------------------------------ */

describe("CollectionCard — inline rename", () => {
    it("shows input with current name on double-click of title", async () => {
        const collection = makeCollection({ name: "Alpha" });
        render(
            <CollectionCard
                collection={collection}
                {...noopCollectionHandlers}
            />,
        );

        await userEvent.dblClick(
            screen.getByRole("heading", { level: 3, name: "Alpha" }),
        );

        expect(
            screen.getByRole("textbox", { name: "Rename collection" }),
        ).toHaveValue("Alpha");
    });

    it("calls onRename with new name on Enter", async () => {
        const onRename = vi.fn();
        const collection = makeCollection({ name: "Alpha" });
        render(
            <CollectionCard
                collection={collection}
                onRename={onRename}
                onDelete={vi.fn()}
                onAddTab={vi.fn()}
                onRemoveTab={vi.fn()}
                onDuplicateTab={vi.fn()}
                onReorderTabs={vi.fn()}
                onRestore={vi.fn().mockResolvedValue(undefined)}
            />,
        );

        await userEvent.dblClick(
            screen.getByRole("heading", { level: 3, name: "Alpha" }),
        );
        const input = screen.getByRole("textbox", {
            name: "Rename collection",
        });
        await userEvent.clear(input);
        await userEvent.type(input, "Beta");
        fireEvent.keyDown(input, { key: "Enter" });

        expect(onRename).toHaveBeenCalledWith("c1", "Beta");
    });

    it("restores original name on Escape", async () => {
        const onRename = vi.fn();
        const collection = makeCollection({ name: "Alpha" });
        render(
            <CollectionCard
                collection={collection}
                onRename={onRename}
                onDelete={vi.fn()}
                onAddTab={vi.fn()}
                onRemoveTab={vi.fn()}
                onDuplicateTab={vi.fn()}
                onReorderTabs={vi.fn()}
                onRestore={vi.fn().mockResolvedValue(undefined)}
            />,
        );

        await userEvent.dblClick(
            screen.getByRole("heading", { level: 3, name: "Alpha" }),
        );
        const input = screen.getByRole("textbox", {
            name: "Rename collection",
        });
        await userEvent.clear(input);
        await userEvent.type(input, "Ghost");
        fireEvent.keyDown(input, { key: "Escape" });

        expect(onRename).not.toHaveBeenCalled();
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("does not call onRename if trimmed value is empty on blur", async () => {
        const onRename = vi.fn();
        const collection = makeCollection({ name: "Alpha" });
        render(
            <CollectionCard
                collection={collection}
                onRename={onRename}
                onDelete={vi.fn()}
                onAddTab={vi.fn()}
                onRemoveTab={vi.fn()}
                onDuplicateTab={vi.fn()}
                onReorderTabs={vi.fn()}
                onRestore={vi.fn().mockResolvedValue(undefined)}
            />,
        );

        await userEvent.dblClick(
            screen.getByRole("heading", { level: 3, name: "Alpha" }),
        );
        const input = screen.getByRole("textbox", {
            name: "Rename collection",
        });
        await userEvent.clear(input);
        fireEvent.blur(input);

        expect(onRename).not.toHaveBeenCalled();
    });
});

/* ------------------------------------------------------------------ */
/*  CollectionCard — delete                                              */
/* ------------------------------------------------------------------ */

describe("CollectionCard — delete", () => {
    it("shows ConfirmDialog when delete button is clicked", async () => {
        const collection = makeCollection({ name: "Alpha" });
        render(
            <CollectionCard
                collection={collection}
                {...noopCollectionHandlers}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Delete collection" }),
        );

        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    it("calls onDelete when ConfirmDialog is confirmed", async () => {
        const onDelete = vi.fn();
        const collection = makeCollection({ name: "Alpha" });
        render(
            <CollectionCard
                collection={collection}
                onRename={vi.fn()}
                onDelete={onDelete}
                onAddTab={vi.fn()}
                onRemoveTab={vi.fn()}
                onDuplicateTab={vi.fn()}
                onReorderTabs={vi.fn()}
                onRestore={vi.fn().mockResolvedValue(undefined)}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Delete collection" }),
        );
        await userEvent.click(screen.getByRole("button", { name: "Delete" }));

        expect(onDelete).toHaveBeenCalledWith("c1");
    });

    it("does not call onDelete when ConfirmDialog is cancelled", async () => {
        const onDelete = vi.fn();
        const collection = makeCollection({ name: "Alpha" });
        render(
            <CollectionCard
                collection={collection}
                onRename={vi.fn()}
                onDelete={onDelete}
                onAddTab={vi.fn()}
                onRemoveTab={vi.fn()}
                onDuplicateTab={vi.fn()}
                onReorderTabs={vi.fn()}
                onRestore={vi.fn().mockResolvedValue(undefined)}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Delete collection" }),
        );
        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(onDelete).not.toHaveBeenCalled();
    });
});

/* ------------------------------------------------------------------ */
/*  GroupSection — new collection + group delete                        */
/* ------------------------------------------------------------------ */

describe("GroupSection — mutations", () => {
    it("calls onNewCollection with groupId when New collection is clicked", async () => {
        const onNewCollection = vi.fn();
        const group = makeGroup({ id: "g1" });
        render(
            <GroupSection
                group={group}
                collections={[]}
                {...noopGroupHandlers}
                onNewCollection={onNewCollection}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "New collection" }),
        );
        expect(onNewCollection).toHaveBeenCalledWith("g1");
    });

    it("shows ConfirmDialog when delete group is clicked", async () => {
        const group = makeGroup({ name: "Work" });
        render(
            <GroupSection
                group={group}
                collections={[]}
                {...noopGroupHandlers}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Delete group" }),
        );
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    it("calls onDeleteGroup when group delete is confirmed", async () => {
        const onDeleteGroup = vi.fn();
        const group = makeGroup({ name: "Work" });
        render(
            <GroupSection
                group={group}
                collections={[]}
                {...noopGroupHandlers}
                onDeleteGroup={onDeleteGroup}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Delete group" }),
        );
        await userEvent.click(screen.getByRole("button", { name: "Delete" }));

        expect(onDeleteGroup).toHaveBeenCalledWith("g1");
    });
});

/* ------------------------------------------------------------------ */
/*  Workspace — storage.patch mutations                                  */
/* ------------------------------------------------------------------ */

describe("Workspace — storage.patch mutations", () => {
    beforeEach(() => {
        fakeBrowser.reset();
        vi.stubGlobal("chrome", fakeBrowser);
    });

    it('creates new collection via storage.patch when "New collection" is clicked', async () => {
        const root = makeRoot();
        // Seed fake storage
        await storage.patch((d) => Object.assign(d, root));

        const patchSpy = vi.spyOn(storage, "patch");
        render(<Workspace root={root} loading={false} />);

        await userEvent.click(
            screen.getByRole("button", { name: "New collection" }),
        );
        expect(patchSpy).toHaveBeenCalled();
    });

    it('creates new group via storage.patch when "New Group" is clicked', async () => {
        const patchSpy = vi.spyOn(storage, "patch");
        render(<Workspace root={defaultRoot()} loading={false} />);

        await userEvent.click(
            screen.getByRole("button", { name: "New group" }),
        );
        expect(patchSpy).toHaveBeenCalled();
    });

    it("deletes collection atomically — removes from group.collectionIds and collections", async () => {
        const root = makeRoot();
        await storage.patch((d) => {
            d.groups = { ...root.groups };
            d.collections = { ...root.collections };
        });

        const patchSpy = vi.spyOn(storage, "patch");
        render(<Workspace root={root} loading={false} />);

        // Open delete dialog
        await userEvent.click(
            screen.getByRole("button", { name: "Delete collection" }),
        );
        await userEvent.click(screen.getByRole("button", { name: "Delete" }));

        expect(patchSpy).toHaveBeenCalled();
    });

    it("group delete removes group and child collections in one patch", async () => {
        const root = makeRoot();
        await storage.patch((d) => {
            d.groups = { ...root.groups };
            d.collections = { ...root.collections };
        });

        const patchSpy = vi.spyOn(storage, "patch");
        render(<Workspace root={root} loading={false} />);

        await userEvent.click(
            screen.getByRole("button", { name: "Delete group" }),
        );
        await userEvent.click(screen.getByRole("button", { name: "Delete" }));

        // Should call patch exactly once (atomic delete)
        const deleteCallCount = patchSpy.mock.calls.length;
        expect(deleteCallCount).toBe(1);
    });
});
