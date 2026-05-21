import { useState, useEffect, useCallback, useRef } from "react";
import { storage } from "../storage/adapter";
import { defaultRoot } from "../storage/defaults";
import type { StorageRoot } from "../storage/schema";

const QUOTA_WARN_RATIO = 0.8;

function getQuotaBytes(): number {
    try {
        return (
            (chrome.storage.local as unknown as { QUOTA_BYTES?: number })
                .QUOTA_BYTES ?? 5_242_880
        );
    } catch {
        return 5_242_880;
    }
}

function checkStorageQuota(onResult: (warning: boolean) => void): void {
    try {
        chrome.storage.local.getBytesInUse(null, (bytes) => {
            onResult(bytes > getQuotaBytes() * QUOTA_WARN_RATIO);
        });
    } catch {
        // unavailable in test environments without chrome.storage
    }
}

/**
 * Subscribes to chrome.storage via StorageAdapter.subscribe.
 * Returns [root, loading, quotaWarning] — loading is true until the first
 * value arrives; quotaWarning is true when storage exceeds 80% of quota.
 */
export function useStorage(): [StorageRoot, boolean, boolean] {
    const [root, setRoot] = useState<StorageRoot>(defaultRoot);
    const [loading, setLoading] = useState(true);
    const [quotaWarning, setQuotaWarning] = useState(false);
    const firstLoad = useRef(true);

    const checkQuota = useCallback(() => {
        checkStorageQuota(setQuotaWarning);
    }, []);

    useEffect(() => {
        try {
            performance.mark("tablocal:load-start");
        } catch {
            /* ignore in environments without performance API */
        }

        const handleUpdate = (r: StorageRoot) => {
            setRoot(r);
            setLoading(false);
            checkQuota();
            if (firstLoad.current) {
                firstLoad.current = false;
                try {
                    performance.mark("tablocal:load-end");
                    performance.measure(
                        "tablocal:cold-load",
                        "tablocal:load-start",
                        "tablocal:load-end",
                    );
                } catch {
                    /* ignore */
                }
            }
        };

        const unsub = storage.subscribe(handleUpdate);
        return unsub;
    }, [checkQuota]);

    return [root, loading, quotaWarning];
}
