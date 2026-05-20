export type BackgroundMessage =
  | {
      type: 'SAVE_WINDOW';
      payload: { windowId?: number; collectionName: string };
    }
  | {
      type: 'RESTORE_COLLECTION';
      payload: { collectionId: string; newWindow: boolean };
    }
  | { type: 'AUTO_GROUP_WINDOW'; payload: { windowId?: number } }
  | { type: 'SYNC_NATIVE_GROUPS'; payload: { windowId?: number } };

export type BackgroundResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };
