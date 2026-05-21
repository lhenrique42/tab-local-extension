export interface TabInfo {
    id: number;
    url: string;
    title: string;
    faviconUrl: string | null;
    windowId: number;
    active: boolean;
    groupId?: number;
}

/**
 * Returns all tabs in the current window.
 */
export async function getCurrentWindowTabs(): Promise<TabInfo[]> {
    try {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        return tabs
            .filter(
                (t): t is chrome.tabs.Tab & { id: number; url: string } =>
                    typeof t.id === "number" && typeof t.url === "string",
            )
            .map((t) => ({
                id: t.id,
                url: t.url,
                title: t.title ?? "",
                faviconUrl: t.favIconUrl ?? null,
                windowId: t.windowId,
                active: t.active ?? false,
                groupId: t.groupId,
            }));
    } catch (err) {
        console.error("[tabs] getCurrentWindowTabs failed:", err);
        return [];
    }
}

/**
 * Creates a new tab at the given URL.
 */
export async function createTab(
    url: string,
    active = false,
): Promise<chrome.tabs.Tab | null> {
    try {
        return await chrome.tabs.create({ url, active });
    } catch (err) {
        console.error("[tabs] createTab failed:", err);
        return null;
    }
}

/**
 * Discards a tab (unloads it from memory; keeps it visible in the tab bar).
 */
export async function discardTab(tabId: number): Promise<void> {
    try {
        await chrome.tabs.discard(tabId);
    } catch (err) {
        console.error("[tabs] discardTab failed:", err);
    }
}

/**
 * Creates a new browser window with the given URL as the first tab.
 * Returns the window object (including its first tab if created).
 */
export async function createWindow(
    url: string,
    focused = false,
): Promise<chrome.windows.Window | null> {
    try {
        return (await chrome.windows.create({ url, focused })) ?? null;
    } catch (err) {
        console.error("[tabs] createWindow failed:", err);
        return null;
    }
}

/**
 * Groups the provided tab IDs into a Chrome tab group, optionally in a target groupId.
 */
export async function groupTabs(
    tabIds: number[],
    options: { groupId?: number; windowId?: number } = {},
): Promise<number | null> {
    if (tabIds.length === 0) {
        return null;
    }
    try {
        const nonEmptyTabIds = tabIds as [number, ...number[]];
        return await chrome.tabs.group({ tabIds: nonEmptyTabIds, ...options });
    } catch (err) {
        console.error("[tabs] groupTabs failed:", err);
        return null;
    }
}
