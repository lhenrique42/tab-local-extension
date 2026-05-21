import type { StorageRoot } from "./schema";
import { migrateRoot } from "./migrations";

const STORAGE_KEY = "__tablocal_root";

export class StorageAdapter {
    /**
     * Reads the root from chrome.storage.local, running migration if needed.
     * Always returns a valid StorageRoot.
     */
    async read(): Promise<StorageRoot> {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const raw = result[STORAGE_KEY] as unknown;
        const root = migrateRoot(raw);

        // Write back if migration produced a new version
        if (
            !raw ||
            (raw as Record<string, unknown>)["__version"] !== root.__version
        ) {
            await chrome.storage.local.set({ [STORAGE_KEY]: root });
        }

        return root;
    }

    /**
     * Reads the root, applies the mutation function on a deep clone, then writes back.
     */
    async patch(fn: (draft: StorageRoot) => void): Promise<void> {
        const current = await this.read();
        const draft = structuredClone(current);
        fn(draft);
        await chrome.storage.local.set({ [STORAGE_KEY]: draft });
    }

    /**
     * Subscribes to storage changes. Calls cb immediately with the current
     * value and again on every subsequent change to the storage key.
     * Returns an unsubscribe function.
     */
    subscribe(cb: (root: StorageRoot) => void): () => void {
        // Fire immediately with current value
        void this.read().then(cb);

        const listener = (
            changes: Record<string, chrome.storage.StorageChange>,
        ) => {
            if (STORAGE_KEY in changes) {
                const newValue = changes[STORAGE_KEY]?.newValue as unknown;
                cb(migrateRoot(newValue));
            }
        };

        chrome.storage.onChanged.addListener(listener);

        return () => {
            chrome.storage.onChanged.removeListener(listener);
        };
    }
}

export const storage = new StorageAdapter();
