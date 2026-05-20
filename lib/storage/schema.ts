export type ChromeGroupColor =
  | "grey"
  | "blue"
  | "red"
  | "yellow"
  | "green"
  | "pink"
  | "purple"
  | "cyan"
  | "orange";

export interface SavedTab {
  id: string;
  url: string;
  title: string;
  faviconUrl: string | null;
  addedAt: number;
}

export interface SavedCollection {
  id: string;
  name: string;
  groupId: string | null;
  chromeGroupColor: ChromeGroupColor | null;
  /** Native Chrome tab group ID — set when saving a window that belongs to a tab group. */
  chromeGroupId?: number;
  tabs: SavedTab[];
  createdAt: number;
  updatedAt: number;
}

export interface SavedGroup {
  id: string;
  name: string;
  color: string;
  collectionIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface UserSettings {
  theme: "dark" | "light" | "system";
  defaultRestoreMode: "discard-background" | "active-all";
  autoGroupByDomainEnabled: boolean;
  nativeGroupSyncEnabled: boolean;
}

export interface StorageRoot {
  __version: 1;
  groups: Record<string, SavedGroup>;
  collections: Record<string, SavedCollection>;
  settings: UserSettings;
}
