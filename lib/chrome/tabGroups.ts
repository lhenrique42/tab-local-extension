/**
 * Returns a tab group by ID.
 */
export async function getTabGroup(
    groupId: number,
): Promise<chrome.tabGroups.TabGroup | null> {
    try {
        return await chrome.tabGroups.get(groupId);
    } catch (err) {
        console.error("[tabGroups] getTabGroup failed:", err);
        return null;
    }
}

/**
 * Updates a tab group's properties (title, color, collapsed).
 */
export async function updateTabGroup(
    groupId: number,
    options: chrome.tabGroups.UpdateProperties,
): Promise<chrome.tabGroups.TabGroup | null> {
    try {
        return (await chrome.tabGroups.update(groupId, options)) ?? null;
    } catch (err) {
        console.error("[tabGroups] updateTabGroup failed:", err);
        return null;
    }
}

/**
 * Returns all tab groups in all windows (or a specific window).
 */
export async function queryTabGroups(
    queryInfo: chrome.tabGroups.QueryInfo = {},
): Promise<chrome.tabGroups.TabGroup[]> {
    try {
        return await chrome.tabGroups.query(queryInfo);
    } catch (err) {
        console.error("[tabGroups] queryTabGroups failed:", err);
        return [];
    }
}
