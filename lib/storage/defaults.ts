import type { StorageRoot } from "./schema";

export const SESSIONS_GROUP_ID = "__sessions__";

export function defaultRoot(): StorageRoot {
    const now = Date.now();
    return {
        __version: 1,
        groups: {
            [SESSIONS_GROUP_ID]: {
                id: SESSIONS_GROUP_ID,
                name: "Saved Sessions",
                color: "blue",
                collectionIds: [],
                createdAt: now,
                updatedAt: now,
            },
        },
        collections: {},
        settings: {
            theme: "dark",
            defaultRestoreMode: "active-all",
            autoGroupByDomainEnabled: true,
            nativeGroupSyncEnabled: true,
            closeTabsAfterSaving: false,
        },
        groupOrder: [SESSIONS_GROUP_ID],
    };
}
