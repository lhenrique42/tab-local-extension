import type { StorageRoot } from "./schema";
import { defaultRoot, SESSIONS_GROUP_ID } from "./defaults";

const CURRENT_VERSION = 1 as const;

/**
 * Accepts any raw value from chrome.storage and returns a valid StorageRoot.
 * Handles missing keys, wrong/missing version, and unknown extra fields.
 */
export function migrateRoot(raw: unknown): StorageRoot {
    const defaults = defaultRoot();

    if (raw === null || raw === undefined || typeof raw !== "object") {
        return defaults;
    }

    const obj = raw as Record<string, unknown>;

    // Apply version-to-version migrations here as new versions are added.
    // For v1 we only need to ensure all required fields exist.

    const version = obj["__version"];

    // Unknown future version — reset to current defaults to avoid corrupt state
    if (typeof version === "number" && version > CURRENT_VERSION) {
        return defaults;
    }

    const migrated: StorageRoot = {
        __version: 1,
        groups:
            obj["groups"] !== null &&
            typeof obj["groups"] === "object" &&
            !Array.isArray(obj["groups"])
                ? (obj["groups"] as StorageRoot["groups"])
                : defaults.groups,
        collections:
            obj["collections"] !== null &&
            typeof obj["collections"] === "object" &&
            !Array.isArray(obj["collections"])
                ? (obj["collections"] as StorageRoot["collections"])
                : defaults.collections,
        settings:
            obj["settings"] !== null && typeof obj["settings"] === "object"
                ? {
                      ...defaults.settings,
                      ...(obj["settings"] as Partial<StorageRoot["settings"]>),
                  }
                : defaults.settings,
    };

    if (Array.isArray(obj["groupOrder"])) {
        migrated.groupOrder = obj["groupOrder"] as string[];
    }

    // Ensure the default sessions group always exists
    if (!migrated.groups[SESSIONS_GROUP_ID]) {
        const now = Date.now();
        migrated.groups[SESSIONS_GROUP_ID] = {
            id: SESSIONS_GROUP_ID,
            name: "Saved Sessions",
            color: "blue",
            collectionIds: [],
            createdAt: now,
            updatedAt: now,
        };
    }

    // Ensure groupOrder is valid and sessions is always first
    {
        const allGroupIds = Object.keys(migrated.groups);
        if (!migrated.groupOrder) {
            const others = allGroupIds
                .filter((id) => id !== SESSIONS_GROUP_ID)
                .sort(
                    (a, b) =>
                        (migrated.groups[a]?.createdAt ?? 0) -
                        (migrated.groups[b]?.createdAt ?? 0),
                );
            migrated.groupOrder = [SESSIONS_GROUP_ID, ...others];
        } else {
            const filtered = migrated.groupOrder.filter(
                (id) => migrated.groups[id],
            );
            for (const id of allGroupIds) {
                if (!filtered.includes(id)) filtered.push(id);
            }
            migrated.groupOrder = [
                SESSIONS_GROUP_ID,
                ...filtered.filter((id) => id !== SESSIONS_GROUP_ID),
            ];
        }
    }

    return migrated;
}
