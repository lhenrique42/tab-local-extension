/**
 * TASK-009 — Tab Link Management unit tests
 *
 * Tests per-tab Add, Remove, and Duplicate actions inside CollectionCard/TabList,
 * plus Workspace-level storage.patch calls for each mutation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBrowser } from "@webext-core/fake-browser";
import { CollectionCard } from "./CollectionCard";
import { Workspace } from "./Workspace";
import type {
    SavedCollection,
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

function makeRoot(collection: SavedCollection): StorageRoot {
    return {
        ...defaultRoot(),
        groups: {
            g1: {
                id: "g1",
                name: "Work",
                color: "blue",
                collectionIds: ["c1"],
                createdAt: 1000,
                updatedAt: 1000,
            },
        },
        collections: { c1: collection },
    };
}

const noopCardHandlers = {
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onAddTab: vi.fn(),
    onRemoveTab: vi.fn(),
    onDuplicateTab: vi.fn(),
    onReorderTabs: vi.fn(),
    onRestore: vi.fn().mockResolvedValue(undefined),
};

/** Helper: expand a CollectionCard by clicking the article */
async function expandCard() {
    await userEvent.click(screen.getByRole("article"));
}

beforeEach(() => {
    vi.clearAllMocks();
    fakeBrowser.reset();
    vi.stubGlobal("chrome", fakeBrowser);
});

/* ------------------------------------------------------------------ */
/*  CollectionCard — Add Tab form                                        */
/* ------------------------------------------------------------------ */

describe("CollectionCard — Add Tab Form", () => {
    it('shows "Add tab" toggle when card is expanded', async () => {
        render(
            <CollectionCard
                collection={makeCollection()}
                {...noopCardHandlers}
            />,
        );
        await expandCard();
        expect(
            screen.getByRole("button", { name: "Add tab" }),
        ).toBeInTheDocument();
    });

    it('shows URL input after clicking "Add tab"', async () => {
        render(
            <CollectionCard
                collection={makeCollection()}
                {...noopCardHandlers}
            />,
        );
        await expandCard();
        await userEvent.click(screen.getByRole("button", { name: "Add tab" }));
        expect(
            screen.getByRole("textbox", { name: "Tab URL" }),
        ).toBeInTheDocument();
    });

    it("calls onAddTab with URL on valid submission", async () => {
        const onAddTab = vi.fn();
        render(
            <CollectionCard
                collection={makeCollection()}
                {...noopCardHandlers}
                onAddTab={onAddTab}
            />,
        );
        await expandCard();
        await userEvent.click(screen.getByRole("button", { name: "Add tab" }));
        await userEvent.type(
            screen.getByRole("textbox", { name: "Tab URL" }),
            "https://newsite.com",
        );
        await userEvent.click(screen.getByRole("button", { name: "Add" }));
        expect(onAddTab).toHaveBeenCalledWith("c1", "https://newsite.com");
    });

    it("shows inline error for invalid URL and does not call onAddTab", async () => {
        const onAddTab = vi.fn();
        render(
            <CollectionCard
                collection={makeCollection()}
                {...noopCardHandlers}
                onAddTab={onAddTab}
            />,
        );
        await expandCard();
        await userEvent.click(screen.getByRole("button", { name: "Add tab" }));
        await userEvent.type(
            screen.getByRole("textbox", { name: "Tab URL" }),
            "not-a-url",
        );
        await userEvent.click(screen.getByRole("button", { name: "Add" }));
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(onAddTab).not.toHaveBeenCalled();
    });

    it("rejects ftp:// URLs as invalid", async () => {
        const onAddTab = vi.fn();
        render(
            <CollectionCard
                collection={makeCollection()}
                {...noopCardHandlers}
                onAddTab={onAddTab}
            />,
        );
        await expandCard();
        await userEvent.click(screen.getByRole("button", { name: "Add tab" }));
        await userEvent.type(
            screen.getByRole("textbox", { name: "Tab URL" }),
            "ftp://example.com",
        );
        await userEvent.click(screen.getByRole("button", { name: "Add" }));
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(onAddTab).not.toHaveBeenCalled();
    });

    it("hides form and clears URL after successful add", async () => {
        render(
            <CollectionCard
                collection={makeCollection()}
                {...noopCardHandlers}
            />,
        );
        await expandCard();
        await userEvent.click(screen.getByRole("button", { name: "Add tab" }));
        await userEvent.type(
            screen.getByRole("textbox", { name: "Tab URL" }),
            "https://newsite.com",
        );
        await userEvent.click(screen.getByRole("button", { name: "Add" }));
        expect(
            screen.queryByRole("textbox", { name: "Tab URL" }),
        ).not.toBeInTheDocument();
    });

    it("hides form when Cancel is clicked", async () => {
        render(
            <CollectionCard
                collection={makeCollection()}
                {...noopCardHandlers}
            />,
        );
        await expandCard();
        await userEvent.click(screen.getByRole("button", { name: "Add tab" }));
        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(
            screen.queryByRole("textbox", { name: "Tab URL" }),
        ).not.toBeInTheDocument();
    });
});

/* ------------------------------------------------------------------ */
/*  CollectionCard — Tab Remove                                          */
/* ------------------------------------------------------------------ */

describe("CollectionCard — Tab Remove", () => {
    it("shows ConfirmDialog when Remove tab is clicked", async () => {
        const collection = makeCollection({
            tabs: [makeTab({ title: "Alpha" })],
        });
        render(
            <CollectionCard collection={collection} {...noopCardHandlers} />,
        );
        await expandCard();
        await userEvent.click(
            screen.getByRole("button", { name: "Remove tab Alpha" }),
        );
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    it("calls onRemoveTab when removal is confirmed", async () => {
        const onRemoveTab = vi.fn();
        const collection = makeCollection({
            tabs: [makeTab({ id: "t1", title: "Alpha" })],
        });
        render(
            <CollectionCard
                collection={collection}
                {...noopCardHandlers}
                onRemoveTab={onRemoveTab}
            />,
        );
        await expandCard();
        await userEvent.click(
            screen.getByRole("button", { name: "Remove tab Alpha" }),
        );
        await userEvent.click(screen.getByRole("button", { name: "Remove" }));
        expect(onRemoveTab).toHaveBeenCalledWith("c1", "t1");
    });

    it("does not call onRemoveTab when removal is cancelled", async () => {
        const onRemoveTab = vi.fn();
        const collection = makeCollection({
            tabs: [makeTab({ title: "Alpha" })],
        });
        render(
            <CollectionCard
                collection={collection}
                {...noopCardHandlers}
                onRemoveTab={onRemoveTab}
            />,
        );
        await expandCard();
        await userEvent.click(
            screen.getByRole("button", { name: "Remove tab Alpha" }),
        );
        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onRemoveTab).not.toHaveBeenCalled();
    });
});

/* ------------------------------------------------------------------ */
/*  CollectionCard — Tab Duplicate                                       */
/* ------------------------------------------------------------------ */

describe("CollectionCard — Tab Duplicate", () => {
    it("calls onDuplicateTab when Duplicate is clicked", async () => {
        const onDuplicateTab = vi.fn();
        const collection = makeCollection({
            tabs: [makeTab({ id: "t1", title: "Alpha" })],
        });
        render(
            <CollectionCard
                collection={collection}
                {...noopCardHandlers}
                onDuplicateTab={onDuplicateTab}
            />,
        );
        await expandCard();
        await userEvent.click(
            screen.getByRole("button", { name: "Duplicate tab Alpha" }),
        );
        expect(onDuplicateTab).toHaveBeenCalledWith("c1", "t1");
    });
});

/* ------------------------------------------------------------------ */
/*  Workspace — storage.patch tab mutations                             */
/* ------------------------------------------------------------------ */

describe("Workspace — tab storage.patch mutations", () => {
    it("patches storage when Add Tab is submitted with valid URL", async () => {
        const collection = makeCollection({ tabs: [] });
        const root = makeRoot(collection);
        await storage.patch((d) => {
            d.groups = { ...root.groups };
            d.collections = { ...root.collections };
        });
        const patchSpy = vi.spyOn(storage, "patch");
        render(<Workspace root={root} loading={false} />);

        // Expand the collection card
        await userEvent.click(screen.getByRole("article"));
        await userEvent.click(screen.getByRole("button", { name: "Add tab" }));
        await userEvent.type(
            screen.getByRole("textbox", { name: "Tab URL" }),
            "https://added.com",
        );
        await userEvent.click(screen.getByRole("button", { name: "Add" }));

        expect(patchSpy).toHaveBeenCalled();
    });

    it("patches storage when tab is removed (confirm)", async () => {
        const collection = makeCollection({
            tabs: [makeTab({ id: "t1", title: "ToRemove" })],
        });
        const root = makeRoot(collection);
        await storage.patch((d) => {
            d.groups = { ...root.groups };
            d.collections = { ...root.collections };
        });
        const patchSpy = vi.spyOn(storage, "patch");
        render(<Workspace root={root} loading={false} />);

        await userEvent.click(screen.getByRole("article"));
        await userEvent.click(
            screen.getByRole("button", { name: "Remove tab ToRemove" }),
        );
        await userEvent.click(screen.getByRole("button", { name: "Remove" }));

        expect(patchSpy).toHaveBeenCalled();
    });

    it("patches storage when tab is duplicated", async () => {
        const collection = makeCollection({
            tabs: [makeTab({ id: "t1", title: "ToDup" })],
        });
        const root = makeRoot(collection);
        await storage.patch((d) => {
            d.groups = { ...root.groups };
            d.collections = { ...root.collections };
        });
        const patchSpy = vi.spyOn(storage, "patch");
        render(<Workspace root={root} loading={false} />);

        await userEvent.click(screen.getByRole("article"));
        await userEvent.click(
            screen.getByRole("button", { name: "Duplicate tab ToDup" }),
        );

        expect(patchSpy).toHaveBeenCalled();
    });

    it("duplicate creates a tab with a new ID (not same as source)", async () => {
        const collection = makeCollection({
            tabs: [makeTab({ id: "original-id", title: "Clone" })],
        });
        const root = makeRoot(collection);
        await storage.patch((d) => {
            d.groups = { ...root.groups };
            d.collections = { ...root.collections };
        });
        render(<Workspace root={root} loading={false} />);

        await userEvent.click(screen.getByRole("article"));
        await userEvent.click(
            screen.getByRole("button", { name: "Duplicate tab Clone" }),
        );

        // Read storage and verify two tabs, second has different ID
        const updated = await storage.read();
        const tabs = updated.collections["c1"]?.tabs ?? [];
        expect(tabs).toHaveLength(2);
        expect(tabs[0]!.id).not.toBe(tabs[1]!.id);
        expect(tabs[1]!.url).toBe(tabs[0]!.url);
    });
});
