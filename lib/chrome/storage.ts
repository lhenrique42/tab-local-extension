const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024; // 5 MB (chrome.storage.local default)

export interface StorageUsage {
    usedBytes: number;
    quotaBytes: number;
}

/**
 * Returns how many bytes are in use in chrome.storage.local,
 * along with the quota. Returns zeroes on error.
 */
export async function getStorageUsage(): Promise<StorageUsage> {
    try {
        const usedBytes = await chrome.storage.local.getBytesInUse(null);
        return { usedBytes, quotaBytes: STORAGE_QUOTA_BYTES };
    } catch {
        return { usedBytes: 0, quotaBytes: STORAGE_QUOTA_BYTES };
    }
}
