import { nanoid } from "nanoid";
import type { StorageAdapter } from "../storage/adapter";
import type { SavedTab, ChromeGroupColor } from "../storage/schema";
import type { BackgroundMessage, BackgroundResponse } from "./types";
import { SESSIONS_GROUP_ID } from "../storage/defaults";
import { getCurrentWindowTabs, createTab, createWindow } from "../chrome/tabs";
import { queryTabGroups } from "../chrome/tabGroups";

const HTTP_PATTERN = /^https?:\/\//;

export type MessageHandler<T extends BackgroundMessage = BackgroundMessage> = (
    msg: T,
    sender: chrome.runtime.MessageSender,
    storageAdapter: StorageAdapter,
) => Promise<BackgroundResponse>;

export const handleSaveWindow: MessageHandler<
    Extract<BackgroundMessage, { type: "SAVE_WINDOW" }>
> = async (msg, _sender, storageAdapter) => {
    try {
        const rawTabs = await getCurrentWindowTabs();
        const httpTabs = rawTabs.filter((t) => HTTP_PATTERN.test(t.url));

        const now = Date.now();
        const savedTabs: SavedTab[] = httpTabs.map((t) => ({
            id: nanoid(),
            url: t.url,
            title: t.title,
            faviconUrl: t.faviconUrl,
            addedAt: now,
        }));

        const collectionId = nanoid();
        await storageAdapter.patch((draft) => {
            // Always save to the dedicated sessions group (guaranteed to exist via migrations)
            let groupId: string = SESSIONS_GROUP_ID;
            if (!draft.groups[groupId]) {
                draft.groups[groupId] = {
                    id: groupId,
                    name: "Saved Sessions",
                    color: "blue",
                    collectionIds: [],
                    createdAt: now,
                    updatedAt: now,
                };
            }
            draft.collections[collectionId] = {
                id: collectionId,
                name: msg.payload.collectionName,
                groupId,
                chromeGroupColor: null,
                tabs: savedTabs,
                createdAt: now,
                updatedAt: now,
            };
            draft.groups[groupId].collectionIds.unshift(collectionId);
        });

        return { ok: true, data: { collectionId, tabCount: savedTabs.length } };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
};

export const handleRestoreCollection: MessageHandler<
    Extract<BackgroundMessage, { type: "RESTORE_COLLECTION" }>
> = async (msg, _sender, storageAdapter) => {
    try {
        const root = await storageAdapter.read();
        const collection = root.collections[msg.payload.collectionId];
        if (!collection) {
            return {
                ok: false,
                error: `Collection '${msg.payload.collectionId}' not found`,
            };
        }

        const tabs = collection.tabs.filter((t) => HTTP_PATTERN.test(t.url));

        if (tabs.length === 0) {
            return {
                ok: true,
                data: { collectionId: msg.payload.collectionId, tabCount: 0 },
            };
        }

        const createdTabIds: number[] = [];

        if (msg.payload.newWindow) {
            // Open first tab in a new window (active by default)
            const win = await createWindow(tabs[0].url);
            const windowId = win?.id;
            const firstTab = win?.tabs?.[0];
            if (firstTab?.id != null) createdTabIds.push(firstTab.id);

            // Open remaining tabs in that window as inactive (background)
            for (const tab of tabs.slice(1)) {
                const created = windowId
                    ? await chrome.tabs.create({
                          url: tab.url,
                          windowId,
                          active: false,
                      })
                    : await createTab(tab.url, false);
                if (created?.id != null) {
                    createdTabIds.push(created.id);
                }
            }
        } else {
            // Open first tab as active in current window
            const firstCreated = await createTab(tabs[0].url, true);
            if (firstCreated?.id != null) createdTabIds.push(firstCreated.id);

            // Open remaining as inactive background tabs
            for (const tab of tabs.slice(1)) {
                const created = await createTab(tab.url, false);
                if (created?.id != null) {
                    createdTabIds.push(created.id);
                }
            }
        }

        return {
            ok: true,
            data: {
                collectionId: msg.payload.collectionId,
                tabCount: createdTabIds.length,
            },
        };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
};

const GROUPABLE_PATTERN = /^https?:\/\//;

export const handleAutoGroupWindow: MessageHandler<
    Extract<BackgroundMessage, { type: "AUTO_GROUP_WINDOW" }>
> = async (msg, _sender, _storageAdapter) => {
    try {
        if (typeof chrome.tabGroups === "undefined") {
            return { ok: true, data: { groupCount: 0 } };
        }

        // Determine target window
        const windowId = msg.payload.windowId;
        const queryInfo: chrome.tabs.QueryInfo = windowId
            ? { windowId }
            : { currentWindow: true };
        const rawTabs = await chrome.tabs.query(queryInfo);

        // Filter to http/https tabs only
        const tabs = rawTabs.filter(
            (t) => t.url && GROUPABLE_PATTERN.test(t.url) && t.id != null,
        );

        if (tabs.length === 0) {
            return { ok: true, data: { groupCount: 0 } };
        }

        // Cluster by hostname
        const clusters = new Map<string, number[]>();
        for (const tab of tabs) {
            try {
                const hostname = new URL(tab.url!).hostname;
                const existing = clusters.get(hostname) ?? [];
                existing.push(tab.id!);
                clusters.set(hostname, existing);
            } catch {
                // Malformed URL — skip
            }
        }

        // Query existing tab groups for idempotency
        const existingGroups = await queryTabGroups(
            windowId ? { windowId } : {},
        );
        const groupByTitle = new Map(
            existingGroups.filter((g) => g.title).map((g) => [g.title!, g.id]),
        );

        let groupCount = 0;

        for (const [hostname, tabIds] of clusters.entries()) {
            if (tabIds.length < 2) continue; // skip singletons

            // Idempotency: reuse existing group with same title
            const existingGroupId = groupByTitle.get(hostname);
            const tabIdsArg = tabIds as [number, ...number[]];
            const groupId = existingGroupId
                ? await chrome.tabs.group({
                      tabIds: tabIdsArg,
                      groupId: existingGroupId,
                  })
                : await chrome.tabs.group({ tabIds: tabIdsArg });

            if (groupId != null) {
                await chrome.tabGroups.update(groupId as number, {
                    title: hostname,
                });
            }
            groupCount++;
        }

        return { ok: true, data: { groupCount } };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
};

export const handleSyncNativeGroups: MessageHandler<
    Extract<BackgroundMessage, { type: "SYNC_NATIVE_GROUPS" }>
> = async (_msg, _sender, storageAdapter) => {
    try {
        if (typeof chrome.tabGroups === "undefined") {
            return { ok: true, data: { syncedCount: 0 } };
        }

        const root = await storageAdapter.read();
        if (!root.settings.nativeGroupSyncEnabled) {
            return { ok: true, data: { syncedCount: 0 } };
        }

        const tabGroups = await queryTabGroups();
        if (tabGroups.length === 0) {
            return { ok: true, data: { syncedCount: 0 } };
        }

        const groupById = new Map(tabGroups.map((g) => [g.id, g]));
        let syncedCount = 0;

        await storageAdapter.patch((draft) => {
            for (const collection of Object.values(draft.collections)) {
                if (collection.chromeGroupId == null) continue;
                const liveGroup = groupById.get(collection.chromeGroupId);
                if (!liveGroup) continue;
                collection.chromeGroupColor =
                    liveGroup.color as ChromeGroupColor;
                if (liveGroup.title) {
                    collection.name = liveGroup.title;
                }
                collection.updatedAt = Date.now();
                syncedCount++;
            }
        });

        return { ok: true, data: { syncedCount } };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
};
