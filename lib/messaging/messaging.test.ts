import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "@webext-core/fake-browser";
import { StorageAdapter } from "../storage/adapter";
import { defaultRoot } from "../storage/defaults";
import {
    handleSaveWindow,
    handleRestoreCollection,
    handleSyncNativeGroups,
    handleAutoGroupWindow,
} from "./handlers";
import { registerNativeGroupSyncListener } from "./nativeGroupSync";
import { sendToBackground } from "./client";

// ──────────────────────────────────────────────
// Setup: wire fakeBrowser chrome global
// ──────────────────────────────────────────────

beforeEach(async () => {
    await fakeBrowser.storage.local.clear();
    vi.stubGlobal("chrome", fakeBrowser);
});

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const dummySender: chrome.runtime.MessageSender = {};

function makeStorage() {
    return new StorageAdapter();
}

// ──────────────────────────────────────────────
// handleSaveWindow
// ──────────────────────────────────────────────

describe("handleSaveWindow", () => {
    it("creates a SavedCollection with the correct tab count", async () => {
        // Mock getCurrentWindowTabs via chrome.tabs.query through fakeBrowser
        vi.spyOn(fakeBrowser.tabs, "query").mockResolvedValue([
            {
                id: 1,
                url: "https://example.com",
                title: "Example",
                favIconUrl: "",
                windowId: 1,
            } as chrome.tabs.Tab,
            {
                id: 2,
                url: "https://github.com",
                title: "GitHub",
                favIconUrl: null,
                windowId: 1,
            } as unknown as chrome.tabs.Tab,
        ]);

        const adapter = makeStorage();
        const result = await handleSaveWindow(
            { type: "SAVE_WINDOW", payload: { collectionName: "My Session" } },
            dummySender,
            adapter,
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect((result.data as { tabCount: number }).tabCount).toBe(2);

        const root = await adapter.read();
        const collections = Object.values(root.collections);
        expect(collections).toHaveLength(1);
        expect(collections[0].name).toBe("My Session");
        expect(collections[0].tabs).toHaveLength(2);
    });

    it("filters out non-http/https tabs", async () => {
        vi.spyOn(fakeBrowser.tabs, "query").mockResolvedValue([
            {
                id: 1,
                url: "https://example.com",
                title: "Example",
                favIconUrl: null,
                windowId: 1,
            } as unknown as chrome.tabs.Tab,
            {
                id: 2,
                url: "chrome://newtab/",
                title: "New Tab",
                favIconUrl: null,
                windowId: 1,
            } as unknown as chrome.tabs.Tab,
            {
                id: 3,
                url: "about:blank",
                title: "",
                favIconUrl: null,
                windowId: 1,
            } as unknown as chrome.tabs.Tab,
        ]);

        const adapter = makeStorage();
        const result = await handleSaveWindow(
            { type: "SAVE_WINDOW", payload: { collectionName: "Filtered" } },
            dummySender,
            adapter,
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect((result.data as { tabCount: number }).tabCount).toBe(1);

        const root = await adapter.read();
        const collection = Object.values(root.collections)[0];
        expect(collection.tabs[0].url).toBe("https://example.com");
    });

    it("patches storage exactly once", async () => {
        vi.spyOn(fakeBrowser.tabs, "query").mockResolvedValue([
            {
                id: 1,
                url: "https://example.com",
                title: "Ex",
                favIconUrl: null,
                windowId: 1,
            } as unknown as chrome.tabs.Tab,
        ]);

        const adapter = makeStorage();
        const patchSpy = vi.spyOn(adapter, "patch");

        await handleSaveWindow(
            { type: "SAVE_WINDOW", payload: { collectionName: "Test" } },
            dummySender,
            adapter,
        );

        expect(patchSpy).toHaveBeenCalledTimes(1);
    });
});

// ──────────────────────────────────────────────
// handleRestoreCollection
// ──────────────────────────────────────────────

describe("handleRestoreCollection", () => {
    function makeCollection(tabs: Array<{ url: string }> = []) {
        const cid = "col1";
        return {
            id: cid,
            name: "Work",
            groupId: null,
            chromeGroupColor: null,
            tabs: tabs.map((t, i) => ({
                id: `t${i}`,
                url: t.url,
                title: t.url,
                faviconUrl: null,
                addedAt: 1000,
            })),
            createdAt: 1000,
            updatedAt: 1000,
        };
    }

    async function seedCollection(
        adapter: StorageAdapter,
        tabs: Array<{ url: string }> = [],
    ) {
        const root = defaultRoot();
        root.collections["col1"] = makeCollection(tabs);
        await fakeBrowser.storage.local.set({ __tablocal_root: root });
        return adapter;
    }

    it("returns ok when collection exists", async () => {
        const adapter = makeStorage();
        await seedCollection(adapter, []);

        const result = await handleRestoreCollection(
            {
                type: "RESTORE_COLLECTION",
                payload: { collectionId: "col1", newWindow: false },
            },
            dummySender,
            adapter,
        );

        expect(result.ok).toBe(true);
    });

    it("returns error when collection does not exist", async () => {
        const adapter = makeStorage();

        const result = await handleRestoreCollection(
            {
                type: "RESTORE_COLLECTION",
                payload: { collectionId: "missing", newWindow: false },
            },
            dummySender,
            adapter,
        );

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toMatch(/not found/);
    });

    it("calls chrome.tabs.create for each restorable tab", async () => {
        const adapter = makeStorage();
        await seedCollection(adapter, [
            { url: "https://a.com" },
            { url: "https://b.com" },
        ]);

        const createSpy = vi
            .spyOn(fakeBrowser.tabs, "create")
            .mockResolvedValue({ id: 1 } as chrome.tabs.Tab);

        await handleRestoreCollection(
            {
                type: "RESTORE_COLLECTION",
                payload: { collectionId: "col1", newWindow: false },
            },
            dummySender,
            adapter,
        );

        expect(createSpy).toHaveBeenCalledTimes(2);
    });

    it("creates first tab with active:true and remaining with active:false", async () => {
        const adapter = makeStorage();
        await seedCollection(adapter, [
            { url: "https://a.com" },
            { url: "https://b.com" },
            { url: "https://c.com" },
        ]);

        const createSpy = vi
            .spyOn(fakeBrowser.tabs, "create")
            .mockResolvedValue({ id: 99 } as chrome.tabs.Tab);

        await handleRestoreCollection(
            {
                type: "RESTORE_COLLECTION",
                payload: { collectionId: "col1", newWindow: false },
            },
            dummySender,
            adapter,
        );

        const calls = createSpy.mock.calls;
        expect(calls[0][0]).toMatchObject({
            url: "https://a.com",
            active: true,
        });
        expect(calls[1][0]).toMatchObject({
            url: "https://b.com",
            active: false,
        });
        expect(calls[2][0]).toMatchObject({
            url: "https://c.com",
            active: false,
        });
    });

    it("opens background tabs as inactive in discard-background mode without calling discard", async () => {
        const adapter = makeStorage();
        const root = defaultRoot();
        root.settings.defaultRestoreMode = "discard-background";
        root.collections["col1"] = makeCollection([
            { url: "https://a.com" },
            { url: "https://b.com" },
        ]);
        await fakeBrowser.storage.local.set({ __tablocal_root: root });

        const createSpy = vi
            .spyOn(fakeBrowser.tabs, "create")
            .mockResolvedValue({
                id: 42,
            } as chrome.tabs.Tab);
        const discardSpy = vi
            .spyOn(fakeBrowser.tabs, "discard")
            .mockResolvedValue(undefined);

        await handleRestoreCollection(
            {
                type: "RESTORE_COLLECTION",
                payload: { collectionId: "col1", newWindow: false },
            },
            dummySender,
            adapter,
        );

        // Second tab should be created inactive — discard must NOT be called (would abort navigation)
        expect(createSpy).toHaveBeenCalledWith(
            expect.objectContaining({ active: false }),
        );
        expect(discardSpy).not.toHaveBeenCalled();
    });

    it("does not discard tabs in active-all mode", async () => {
        const adapter = makeStorage();
        const root = defaultRoot();
        root.settings.defaultRestoreMode = "active-all";
        root.collections["col1"] = makeCollection([
            { url: "https://a.com" },
            { url: "https://b.com" },
        ]);
        await fakeBrowser.storage.local.set({ __tablocal_root: root });

        vi.spyOn(fakeBrowser.tabs, "create").mockResolvedValue({
            id: 10,
        } as chrome.tabs.Tab);
        const discardSpy = vi
            .spyOn(fakeBrowser.tabs, "discard")
            .mockResolvedValue(undefined);

        await handleRestoreCollection(
            {
                type: "RESTORE_COLLECTION",
                payload: { collectionId: "col1", newWindow: false },
            },
            dummySender,
            adapter,
        );

        expect(discardSpy).not.toHaveBeenCalled();
    });

    it("calls chrome.windows.create when newWindow is true", async () => {
        const adapter = makeStorage();
        await seedCollection(adapter, [
            { url: "https://a.com" },
            { url: "https://b.com" },
        ]);

        const windowCreateSpy = vi
            .spyOn(fakeBrowser.windows, "create")
            .mockResolvedValue({
                id: 5,
                focused: true,
                incognito: false,
                alwaysOnTop: false,
                tabs: [
                    {
                        id: 55,
                        index: 0,
                        highlighted: false,
                        active: true,
                        pinned: false,
                        incognito: false,
                         
                    } as any,
                ],
            });

        vi.spyOn(fakeBrowser.tabs, "create").mockResolvedValue({
            id: 56,
        } as chrome.tabs.Tab);

        const result = await handleRestoreCollection(
            {
                type: "RESTORE_COLLECTION",
                payload: { collectionId: "col1", newWindow: true },
            },
            dummySender,
            adapter,
        );

        expect(result.ok).toBe(true);
        expect(windowCreateSpy).toHaveBeenCalledTimes(1);
        expect(windowCreateSpy).toHaveBeenCalledWith(
            expect.objectContaining({ url: "https://a.com" }),
        );
    });

    it("filters out non-http/https URLs", async () => {
        const adapter = makeStorage();
        const root = defaultRoot();
        root.collections["col1"] = makeCollection([
            { url: "https://a.com" },
            { url: "chrome://newtab/" },
            { url: "about:blank" },
        ]);
        await fakeBrowser.storage.local.set({ __tablocal_root: root });

        const createSpy = vi
            .spyOn(fakeBrowser.tabs, "create")
            .mockResolvedValue({ id: 1 } as chrome.tabs.Tab);

        await handleRestoreCollection(
            {
                type: "RESTORE_COLLECTION",
                payload: { collectionId: "col1", newWindow: false },
            },
            dummySender,
            adapter,
        );

        // Only the https tab should be created
        expect(createSpy).toHaveBeenCalledTimes(1);
        expect(createSpy).toHaveBeenCalledWith(
            expect.objectContaining({ url: "https://a.com" }),
        );
    });

    it("returns ok with tabCount 0 when all URLs are non-http", async () => {
        const adapter = makeStorage();
        const root = defaultRoot();
        root.collections["col1"] = makeCollection([
            { url: "chrome://newtab/" },
        ]);
        await fakeBrowser.storage.local.set({ __tablocal_root: root });

        const result = await handleRestoreCollection(
            {
                type: "RESTORE_COLLECTION",
                payload: { collectionId: "col1", newWindow: false },
            },
            dummySender,
            adapter,
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect((result.data as { tabCount: number }).tabCount).toBe(0);
    });
});

// ──────────────────────────────────────────────
// sendToBackground
// ──────────────────────────────────────────────

describe("sendToBackground", () => {
    it("calls chrome.runtime.sendMessage with the correct message shape", async () => {
        const sendSpy = vi
            .spyOn(fakeBrowser.runtime, "sendMessage")
            .mockResolvedValue({
                ok: true,
                data: { collectionId: "abc", tabCount: 3 },
            });

        await sendToBackground({
            type: "SAVE_WINDOW",
            payload: { collectionName: "Test" },
        });

        expect(sendSpy).toHaveBeenCalledWith({
            type: "SAVE_WINDOW",
            payload: { collectionName: "Test" },
        });
    });

    it("returns BackgroundResponse ok:false when sendMessage throws", async () => {
        vi.spyOn(fakeBrowser.runtime, "sendMessage").mockRejectedValue(
            new Error("Extension context invalidated"),
        );

        const result = await sendToBackground({
            type: "SAVE_WINDOW",
            payload: { collectionName: "Test" },
        });

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toMatch(/Extension context/);
    });
});

// ──────────────────────────────────────────────
// Integration: SAVE_WINDOW → storage
// ──────────────────────────────────────────────

describe("Integration: SAVE_WINDOW → storage", () => {
    it("sending SAVE_WINDOW and reading storage yields a new collection entry", async () => {
        vi.spyOn(fakeBrowser.tabs, "query").mockResolvedValue([
            {
                id: 10,
                url: "https://notion.so",
                title: "Notion",
                favIconUrl: null,
                windowId: 1,
            } as unknown as chrome.tabs.Tab,
            {
                id: 11,
                url: "https://linear.app",
                title: "Linear",
                favIconUrl: null,
                windowId: 1,
            } as unknown as chrome.tabs.Tab,
        ]);

        const adapter = makeStorage();
        await handleSaveWindow(
            {
                type: "SAVE_WINDOW",
                payload: { collectionName: "Sprint Board" },
            },
            dummySender,
            adapter,
        );

        const root = await adapter.read();
        const collections = Object.values(root.collections);
        expect(collections).toHaveLength(1);
        expect(collections[0].name).toBe("Sprint Board");
        expect(collections[0].tabs).toHaveLength(2);
        expect(collections[0].tabs[0].url).toBe("https://notion.so");
    });
});

// ──────────────────────────────────────────────
// handleSyncNativeGroups
// ──────────────────────────────────────────────

describe("handleSyncNativeGroups", () => {
    const syncMsg = {
        type: "SYNC_NATIVE_GROUPS" as const,
        payload: {},
    };

    function makeCollectionWithGroup(chromeGroupId: number, color = "blue") {
        return {
            id: "col1",
            name: "Work",
            groupId: null,
            chromeGroupColor: color as "blue",
            chromeGroupId,
            tabs: [],
            createdAt: 1000,
            updatedAt: 1000,
        };
    }

    function mockTabGroupsAPI(
        groups: Partial<chrome.tabGroups.TabGroup>[] = [],
    ) {
        const fakeTabGroups = {
            query: vi.fn().mockResolvedValue(groups),
        };
        vi.stubGlobal("chrome", { ...fakeBrowser, tabGroups: fakeTabGroups });
        return fakeTabGroups;
    }

    it("returns syncedCount 0 when chrome.tabGroups is unavailable", async () => {
        vi.stubGlobal("chrome", { ...fakeBrowser, tabGroups: undefined });
        const adapter = makeStorage();
        const result = await handleSyncNativeGroups(
            syncMsg,
            dummySender,
            adapter,
        );
        expect(result).toEqual({ ok: true, data: { syncedCount: 0 } });
    });

    it("returns syncedCount 0 when nativeGroupSyncEnabled is false", async () => {
        mockTabGroupsAPI([]);
        const adapter = makeStorage();
        const root = defaultRoot();
        root.settings.nativeGroupSyncEnabled = false;
        await fakeBrowser.storage.local.set({ __tablocal_root: root });
        const result = await handleSyncNativeGroups(
            syncMsg,
            dummySender,
            adapter,
        );
        expect(result).toEqual({ ok: true, data: { syncedCount: 0 } });
    });

    it("updates chromeGroupColor when collection has matching chromeGroupId", async () => {
        mockTabGroupsAPI([{ id: 42, color: "red", title: "" }]);
        const adapter = makeStorage();
        const root = defaultRoot();
        root.settings.nativeGroupSyncEnabled = true;
        root.collections["col1"] = makeCollectionWithGroup(42, "blue");
        await fakeBrowser.storage.local.set({ __tablocal_root: root });

        const result = await handleSyncNativeGroups(
            syncMsg,
            dummySender,
            adapter,
        );

        expect(result).toEqual({ ok: true, data: { syncedCount: 1 } });
        const updated = await adapter.read();
        expect(updated.collections["col1"].chromeGroupColor).toBe("red");
    });

    it("updates collection name when tab group has a non-empty title", async () => {
        mockTabGroupsAPI([{ id: 42, color: "green", title: "Dev Tabs" }]);
        const adapter = makeStorage();
        const root = defaultRoot();
        root.settings.nativeGroupSyncEnabled = true;
        root.collections["col1"] = makeCollectionWithGroup(42);
        await fakeBrowser.storage.local.set({ __tablocal_root: root });

        await handleSyncNativeGroups(syncMsg, dummySender, adapter);

        const updated = await adapter.read();
        expect(updated.collections["col1"].name).toBe("Dev Tabs");
    });

    it("does not update name when tab group title is empty", async () => {
        mockTabGroupsAPI([{ id: 42, color: "green", title: "" }]);
        const adapter = makeStorage();
        const root = defaultRoot();
        root.settings.nativeGroupSyncEnabled = true;
        root.collections["col1"] = makeCollectionWithGroup(42);
        await fakeBrowser.storage.local.set({ __tablocal_root: root });

        await handleSyncNativeGroups(syncMsg, dummySender, adapter);

        const updated = await adapter.read();
        expect(updated.collections["col1"].name).toBe("Work");
    });

    it("silently ignores collections with no matching chromeGroupId", async () => {
        mockTabGroupsAPI([{ id: 99, color: "purple", title: "Other" }]);
        const adapter = makeStorage();
        const root = defaultRoot();
        root.settings.nativeGroupSyncEnabled = true;
        root.collections["col1"] = makeCollectionWithGroup(42, "blue");
        await fakeBrowser.storage.local.set({ __tablocal_root: root });

        const result = await handleSyncNativeGroups(
            syncMsg,
            dummySender,
            adapter,
        );
        expect(result).toEqual({ ok: true, data: { syncedCount: 0 } });
        const updated = await adapter.read();
        expect(updated.collections["col1"].chromeGroupColor).toBe("blue");
    });

    it("returns correct syncedCount when multiple collections are updated", async () => {
        mockTabGroupsAPI([
            { id: 10, color: "cyan", title: "" },
            { id: 20, color: "orange", title: "" },
        ]);
        const adapter = makeStorage();
        const root = defaultRoot();
        root.settings.nativeGroupSyncEnabled = true;
        root.collections["col1"] = {
            ...makeCollectionWithGroup(10),
            id: "col1",
        };
        root.collections["col2"] = {
            ...makeCollectionWithGroup(20),
            id: "col2",
        };
        await fakeBrowser.storage.local.set({ __tablocal_root: root });

        const result = await handleSyncNativeGroups(
            syncMsg,
            dummySender,
            adapter,
        );
        expect(result).toEqual({ ok: true, data: { syncedCount: 2 } });
    });
});

// ──────────────────────────────────────────────
// registerNativeGroupSyncListener
// ──────────────────────────────────────────────

describe("registerNativeGroupSyncListener", () => {
    it("returns undefined when chrome.tabGroups is unavailable", () => {
        vi.stubGlobal("chrome", { ...fakeBrowser, tabGroups: undefined });
        const adapter = makeStorage();
        const cleanup = registerNativeGroupSyncListener(adapter);
        expect(cleanup).toBeUndefined();
    });

    it("registers a listener on chrome.tabGroups.onUpdated when available", () => {
        const addListenerSpy = vi.fn();
        const removeListenerSpy = vi.fn();
        vi.stubGlobal("chrome", {
            ...fakeBrowser,
            tabGroups: {
                onUpdated: {
                    addListener: addListenerSpy,
                    removeListener: removeListenerSpy,
                },
            },
        });
        const adapter = makeStorage();
        const cleanup = registerNativeGroupSyncListener(adapter);
        expect(addListenerSpy).toHaveBeenCalledTimes(1);
        expect(typeof cleanup).toBe("function");
    });

    it("cleanup function removes the listener", () => {
        const addListenerSpy = vi.fn();
        const removeListenerSpy = vi.fn();
        vi.stubGlobal("chrome", {
            ...fakeBrowser,
            tabGroups: {
                onUpdated: {
                    addListener: addListenerSpy,
                    removeListener: removeListenerSpy,
                },
            },
        });
        const adapter = makeStorage();
        const cleanup = registerNativeGroupSyncListener(adapter)!;
        cleanup();
        expect(removeListenerSpy).toHaveBeenCalledTimes(1);
    });

    it("listener is a no-op when nativeGroupSyncEnabled is false", async () => {
        let capturedListener:
            | ((g: chrome.tabGroups.TabGroup) => Promise<void>)
            | undefined;
        vi.stubGlobal("chrome", {
            ...fakeBrowser,
            tabGroups: {
                onUpdated: {
                    addListener: (
                        fn: (g: chrome.tabGroups.TabGroup) => Promise<void>,
                    ) => {
                        capturedListener = fn;
                    },
                    removeListener: vi.fn(),
                },
            },
        });
        const adapter = makeStorage();
        const root = defaultRoot();
        root.settings.nativeGroupSyncEnabled = false;
        root.collections["col1"] = {
            id: "col1",
            name: "Work",
            groupId: null,
            chromeGroupColor: "blue",
            chromeGroupId: 42,
            tabs: [],
            createdAt: 1000,
            updatedAt: 1000,
        };
        await fakeBrowser.storage.local.set({ __tablocal_root: root });
        registerNativeGroupSyncListener(adapter);

        await capturedListener!({
            id: 42,
            color: "red",
            title: "Updated",
        } as chrome.tabGroups.TabGroup);

        const updated = await adapter.read();
        expect(updated.collections["col1"].chromeGroupColor).toBe("blue");
    });

    it("listener patches storage when triggered with a matching group", async () => {
        let capturedListener:
            | ((g: chrome.tabGroups.TabGroup) => Promise<void>)
            | undefined;
        vi.stubGlobal("chrome", {
            ...fakeBrowser,
            tabGroups: {
                onUpdated: {
                    addListener: (
                        fn: (g: chrome.tabGroups.TabGroup) => Promise<void>,
                    ) => {
                        capturedListener = fn;
                    },
                    removeListener: vi.fn(),
                },
            },
        });
        const adapter = makeStorage();
        const root = defaultRoot();
        root.settings.nativeGroupSyncEnabled = true;
        root.collections["col1"] = {
            id: "col1",
            name: "Work",
            groupId: null,
            chromeGroupColor: "blue",
            chromeGroupId: 42,
            tabs: [],
            createdAt: 1000,
            updatedAt: 1000,
        };
        await fakeBrowser.storage.local.set({ __tablocal_root: root });
        registerNativeGroupSyncListener(adapter);

        await capturedListener!({
            id: 42,
            color: "red",
            title: "New Name",
        } as chrome.tabGroups.TabGroup);

        const updated = await adapter.read();
        expect(updated.collections["col1"].chromeGroupColor).toBe("red");
        expect(updated.collections["col1"].name).toBe("New Name");
    });
});

// ──────────────────────────────────────────────
// handleAutoGroupWindow
// ──────────────────────────────────────────────

describe("handleAutoGroupWindow", () => {
    const autoGroupMsg = {
        type: "AUTO_GROUP_WINDOW" as const,
        payload: {} as { windowId?: number },
    };

    function setupTabGroupsAPI(
        tabs: Partial<chrome.tabs.Tab>[] = [],
        existingGroups: Partial<chrome.tabGroups.TabGroup>[] = [],
    ) {
        const groupSpy = vi.fn().mockResolvedValue(99);
        const groupUpdateSpy = vi.fn().mockResolvedValue(undefined);
        vi.spyOn(fakeBrowser.tabs, "query").mockResolvedValue(
            tabs as chrome.tabs.Tab[],
        );
        vi.stubGlobal("chrome", {
            ...fakeBrowser,
            tabs: {
                ...fakeBrowser.tabs,
                query: vi.fn().mockResolvedValue(tabs),
                group: groupSpy,
            },
            tabGroups: {
                query: vi.fn().mockResolvedValue(existingGroups),
                update: groupUpdateSpy,
            },
        });
        return { groupSpy, groupUpdateSpy };
    }

    it("returns groupCount 0 when chrome.tabGroups is unavailable", async () => {
        vi.stubGlobal("chrome", { ...fakeBrowser, tabGroups: undefined });
        const adapter = makeStorage();
        const result = await handleAutoGroupWindow(
            autoGroupMsg,
            dummySender,
            adapter,
        );
        expect(result).toEqual({ ok: true, data: { groupCount: 0 } });
    });

    it("returns groupCount 0 when no http tabs are present", async () => {
        setupTabGroupsAPI([
            { id: 1, url: "chrome://newtab", windowId: 1 },
            { id: 2, url: "about:blank", windowId: 1 },
        ]);
        const adapter = makeStorage();
        const result = await handleAutoGroupWindow(
            autoGroupMsg,
            dummySender,
            adapter,
        );
        expect(result).toEqual({ ok: true, data: { groupCount: 0 } });
    });

    it("skips singleton hostnames (only 1 tab on domain)", async () => {
        const { groupSpy } = setupTabGroupsAPI([
            { id: 1, url: "https://example.com/a", windowId: 1 },
            { id: 2, url: "https://github.com/b", windowId: 1 },
        ]);
        const adapter = makeStorage();
        await handleAutoGroupWindow(autoGroupMsg, dummySender, adapter);
        expect(groupSpy).not.toHaveBeenCalled();
    });

    it("groups tabs with 2+ tabs on the same hostname", async () => {
        const { groupSpy, groupUpdateSpy } = setupTabGroupsAPI([
            { id: 1, url: "https://github.com/a", windowId: 1 },
            { id: 2, url: "https://github.com/b", windowId: 1 },
            { id: 3, url: "https://notion.so/x", windowId: 1 },
        ]);
        const adapter = makeStorage();
        const result = await handleAutoGroupWindow(
            autoGroupMsg,
            dummySender,
            adapter,
        );
        expect(groupSpy).toHaveBeenCalledOnce();
        expect(groupSpy).toHaveBeenCalledWith({ tabIds: [1, 2] });
        expect(groupUpdateSpy).toHaveBeenCalledWith(99, {
            title: "github.com",
        });
        expect(result).toEqual({ ok: true, data: { groupCount: 1 } });
    });

    it("clusters multiple hostnames independently", async () => {
        const { groupSpy } = setupTabGroupsAPI([
            { id: 1, url: "https://github.com/a", windowId: 1 },
            { id: 2, url: "https://github.com/b", windowId: 1 },
            { id: 3, url: "https://notion.so/x", windowId: 1 },
            { id: 4, url: "https://notion.so/y", windowId: 1 },
        ]);
        const adapter = makeStorage();
        const result = await handleAutoGroupWindow(
            autoGroupMsg,
            dummySender,
            adapter,
        );
        expect(groupSpy).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ ok: true, data: { groupCount: 2 } });
    });

    it("skips chrome:// and about: URLs", async () => {
        const { groupSpy } = setupTabGroupsAPI([
            { id: 1, url: "chrome://extensions", windowId: 1 },
            { id: 2, url: "about:blank", windowId: 1 },
            { id: 3, url: "https://example.com/1", windowId: 1 },
            { id: 4, url: "https://example.com/2", windowId: 1 },
        ]);
        const adapter = makeStorage();
        await handleAutoGroupWindow(autoGroupMsg, dummySender, adapter);
        expect(groupSpy).toHaveBeenCalledOnce();
        expect(groupSpy).toHaveBeenCalledWith({ tabIds: [3, 4] });
    });

    it("reuses existing group with same title for idempotency", async () => {
        const { groupSpy } = setupTabGroupsAPI(
            [
                { id: 1, url: "https://github.com/a", windowId: 1 },
                { id: 2, url: "https://github.com/b", windowId: 1 },
            ],
            [{ id: 55, title: "github.com", color: "blue" }],
        );
        const adapter = makeStorage();
        await handleAutoGroupWindow(autoGroupMsg, dummySender, adapter);
        expect(groupSpy).toHaveBeenCalledWith({ tabIds: [1, 2], groupId: 55 });
    });

    it("returns ok:false on chrome API error", async () => {
        vi.stubGlobal("chrome", {
            ...fakeBrowser,
            tabs: {
                ...fakeBrowser.tabs,
                query: vi.fn().mockResolvedValue([
                    { id: 1, url: "https://github.com/a", windowId: 1 },
                    { id: 2, url: "https://github.com/b", windowId: 1 },
                ]),
                group: vi.fn().mockRejectedValue(new Error("API error")),
            },
            tabGroups: {
                query: vi.fn().mockResolvedValue([]),
                update: vi.fn(),
            },
        });
        const adapter = makeStorage();
        const result = await handleAutoGroupWindow(
            autoGroupMsg,
            dummySender,
            adapter,
        );
        expect(result).toEqual({ ok: false, error: "API error" });
    });
});
