import type { StorageAdapter } from "../storage/adapter";
import type { ChromeGroupColor } from "../storage/schema";

/**
 * Registers the `chrome.tabGroups.onUpdated` listener for uni-directional
 * Chrome-to-storage color/title sync.
 *
 * - No-ops silently when `chrome.tabGroups` is unavailable (old Chrome).
 * - Re-checks `nativeGroupSyncEnabled` on every event so settings changes
 *   take effect immediately without restarting the SW.
 *
 * @param storageAdapter — injectable for testing
 * @returns A cleanup function that removes the listener, or undefined if
 *          the listener was not registered.
 */
export function registerNativeGroupSyncListener(
  storageAdapter: StorageAdapter,
): (() => void) | undefined {
  if (typeof chrome?.tabGroups === "undefined") {
    return undefined;
  }

  async function onTabGroupUpdated(
    group: chrome.tabGroups.TabGroup,
  ): Promise<void> {
    try {
      const root = await storageAdapter.read();
      if (!root.settings.nativeGroupSyncEnabled) return;

      const collectionsToUpdate = Object.values(root.collections).filter(
        (c) => c.chromeGroupId === group.id,
      );

      if (collectionsToUpdate.length === 0) return;

      await storageAdapter.patch((draft) => {
        for (const col of Object.values(draft.collections)) {
          if (col.chromeGroupId !== group.id) continue;
          col.chromeGroupColor = group.color as ChromeGroupColor;
          if (group.title) {
            col.name = group.title;
          }
          col.updatedAt = Date.now();
        }
      });
    } catch (err) {
      console.error("[nativeGroupSync] onTabGroupUpdated failed:", err);
    }
  }

  chrome.tabGroups.onUpdated.addListener(onTabGroupUpdated);

  return () => {
    chrome.tabGroups.onUpdated.removeListener(onTabGroupUpdated);
  };
}
