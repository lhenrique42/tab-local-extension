import type { StorageRoot } from "./schema";
import { defaultRoot } from "./defaults";

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

  return migrated;
}
