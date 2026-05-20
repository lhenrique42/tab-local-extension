import { nanoid } from "nanoid";
import type { StorageAdapter } from "../storage/adapter";
import type { SavedTab } from "../storage/schema";
import type { BackgroundMessage, BackgroundResponse } from "./types";
import { getCurrentWindowTabs } from "../chrome/tabs";

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
      draft.collections[collectionId] = {
        id: collectionId,
        name: msg.payload.collectionName,
        groupId: null,
        chromeGroupColor: null,
        tabs: savedTabs,
        createdAt: now,
        updatedAt: now,
      };
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
    return { ok: true, data: { collectionId: msg.payload.collectionId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
};

export const handleAutoGroupWindow: MessageHandler<
  Extract<BackgroundMessage, { type: "AUTO_GROUP_WINDOW" }>
> = async (_msg, _sender, _storageAdapter) => {
  // Stub — full implementation in TASK-011
  return { ok: true, data: null };
};

export const handleSyncNativeGroups: MessageHandler<
  Extract<BackgroundMessage, { type: "SYNC_NATIVE_GROUPS" }>
> = async (_msg, _sender, _storageAdapter) => {
  // Stub — full implementation in TASK-011
  return { ok: true, data: null };
};
