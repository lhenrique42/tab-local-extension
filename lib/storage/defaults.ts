import type { StorageRoot } from './schema';

export function defaultRoot(): StorageRoot {
  return {
    __version: 1,
    groups: {},
    collections: {},
    settings: {
      theme: 'system',
      defaultRestoreMode: 'discard-background',
      autoGroupByDomainEnabled: false,
      nativeGroupSyncEnabled: false,
    },
  };
}
