import { useState, useEffect } from 'react';
import { storage } from '../storage/adapter';
import { defaultRoot } from '../storage/defaults';
import type { StorageRoot } from '../storage/schema';

/**
 * Subscribes to chrome.storage via StorageAdapter.subscribe.
 * Returns [root, loading] — loading is true until the first value arrives.
 */
export function useStorage(): [StorageRoot, boolean] {
  const [root, setRoot] = useState<StorageRoot>(defaultRoot);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = storage.subscribe((r) => {
      setRoot(r);
      setLoading(false);
    });
    return unsub;
  }, []);

  return [root, loading];
}
