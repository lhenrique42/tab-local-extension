import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';
import { StorageAdapter } from '../storage/adapter';
import { defaultRoot } from '../storage/defaults';
import { handleSaveWindow, handleRestoreCollection } from './handlers';
import { sendToBackground } from './client';

// ──────────────────────────────────────────────
// Setup: wire fakeBrowser chrome global
// ──────────────────────────────────────────────

beforeEach(async () => {
  await fakeBrowser.storage.local.clear();
  vi.stubGlobal('chrome', fakeBrowser);
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

describe('handleSaveWindow', () => {
  it('creates a SavedCollection with the correct tab count', async () => {
    // Mock getCurrentWindowTabs via chrome.tabs.query through fakeBrowser
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([
      { id: 1, url: 'https://example.com', title: 'Example', favIconUrl: '', windowId: 1 } as chrome.tabs.Tab,
      { id: 2, url: 'https://github.com', title: 'GitHub', favIconUrl: null, windowId: 1 } as unknown as chrome.tabs.Tab,
    ]);

    const adapter = makeStorage();
    const result = await handleSaveWindow(
      { type: 'SAVE_WINDOW', payload: { collectionName: 'My Session' } },
      dummySender,
      adapter,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.data as { tabCount: number }).tabCount).toBe(2);

    const root = await adapter.read();
    const collections = Object.values(root.collections);
    expect(collections).toHaveLength(1);
    expect(collections[0].name).toBe('My Session');
    expect(collections[0].tabs).toHaveLength(2);
  });

  it('filters out non-http/https tabs', async () => {
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([
      { id: 1, url: 'https://example.com', title: 'Example', favIconUrl: null, windowId: 1 } as unknown as chrome.tabs.Tab,
      { id: 2, url: 'chrome://newtab/', title: 'New Tab', favIconUrl: null, windowId: 1 } as unknown as chrome.tabs.Tab,
      { id: 3, url: 'about:blank', title: '', favIconUrl: null, windowId: 1 } as unknown as chrome.tabs.Tab,
    ]);

    const adapter = makeStorage();
    const result = await handleSaveWindow(
      { type: 'SAVE_WINDOW', payload: { collectionName: 'Filtered' } },
      dummySender,
      adapter,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.data as { tabCount: number }).tabCount).toBe(1);

    const root = await adapter.read();
    const collection = Object.values(root.collections)[0];
    expect(collection.tabs[0].url).toBe('https://example.com');
  });

  it('patches storage exactly once', async () => {
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([
      { id: 1, url: 'https://example.com', title: 'Ex', favIconUrl: null, windowId: 1 } as unknown as chrome.tabs.Tab,
    ]);

    const adapter = makeStorage();
    const patchSpy = vi.spyOn(adapter, 'patch');

    await handleSaveWindow(
      { type: 'SAVE_WINDOW', payload: { collectionName: 'Test' } },
      dummySender,
      adapter,
    );

    expect(patchSpy).toHaveBeenCalledTimes(1);
  });
});

// ──────────────────────────────────────────────
// handleRestoreCollection
// ──────────────────────────────────────────────

describe('handleRestoreCollection', () => {
  it('returns ok when collection exists', async () => {
    const adapter = makeStorage();
    const root = defaultRoot();
    const cid = 'col1';
    root.collections[cid] = {
      id: cid,
      name: 'Work',
      groupId: null,
      chromeGroupColor: null,
      tabs: [],
      createdAt: 1000,
      updatedAt: 1000,
    };
    await fakeBrowser.storage.local.set({ __tablocal_root: root });

    const result = await handleRestoreCollection(
      { type: 'RESTORE_COLLECTION', payload: { collectionId: cid, newWindow: false } },
      dummySender,
      adapter,
    );

    expect(result.ok).toBe(true);
  });

  it('returns error when collection does not exist', async () => {
    const adapter = makeStorage();

    const result = await handleRestoreCollection(
      { type: 'RESTORE_COLLECTION', payload: { collectionId: 'missing', newWindow: false } },
      dummySender,
      adapter,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/not found/);
  });
});

// ──────────────────────────────────────────────
// sendToBackground
// ──────────────────────────────────────────────

describe('sendToBackground', () => {
  it('calls chrome.runtime.sendMessage with the correct message shape', async () => {
    const sendSpy = vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockResolvedValue({
      ok: true,
      data: { collectionId: 'abc', tabCount: 3 },
    });

    await sendToBackground({
      type: 'SAVE_WINDOW',
      payload: { collectionName: 'Test' },
    });

    expect(sendSpy).toHaveBeenCalledWith({
      type: 'SAVE_WINDOW',
      payload: { collectionName: 'Test' },
    });
  });

  it('returns BackgroundResponse ok:false when sendMessage throws', async () => {
    vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockRejectedValue(new Error('Extension context invalidated'));

    const result = await sendToBackground({
      type: 'SAVE_WINDOW',
      payload: { collectionName: 'Test' },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Extension context/);
  });
});

// ──────────────────────────────────────────────
// Integration: SAVE_WINDOW → storage
// ──────────────────────────────────────────────

describe('Integration: SAVE_WINDOW → storage', () => {
  it('sending SAVE_WINDOW and reading storage yields a new collection entry', async () => {
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([
      { id: 10, url: 'https://notion.so', title: 'Notion', favIconUrl: null, windowId: 1 } as unknown as chrome.tabs.Tab,
      { id: 11, url: 'https://linear.app', title: 'Linear', favIconUrl: null, windowId: 1 } as unknown as chrome.tabs.Tab,
    ]);

    const adapter = makeStorage();
    await handleSaveWindow(
      { type: 'SAVE_WINDOW', payload: { collectionName: 'Sprint Board' } },
      dummySender,
      adapter,
    );

    const root = await adapter.read();
    const collections = Object.values(root.collections);
    expect(collections).toHaveLength(1);
    expect(collections[0].name).toBe('Sprint Board');
    expect(collections[0].tabs).toHaveLength(2);
    expect(collections[0].tabs[0].url).toBe('https://notion.so');
  });
});
