export type { BackgroundMessage, BackgroundResponse } from './types';
export { sendToBackground } from './client';
export {
  handleSaveWindow,
  handleRestoreCollection,
  handleAutoGroupWindow,
  handleSyncNativeGroups,
} from './handlers';
