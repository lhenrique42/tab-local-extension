import { storage } from "../lib/storage/adapter";
import type { BackgroundMessage } from "../lib/messaging/types";
import {
  handleSaveWindow,
  handleRestoreCollection,
  handleAutoGroupWindow,
  handleSyncNativeGroups,
} from "../lib/messaging/handlers";
import { registerNativeGroupSyncListener } from "../lib/messaging/nativeGroupSync";

export default defineBackground(() => {
  // Register Chrome tab group sync listener (no-op if API unavailable)
  registerNativeGroupSyncListener(storage);

  chrome.commands.onCommand.addListener((command) => {
    if (command === "save-window") {
      const now = new Date();
      const name = `Session ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
      void handleSaveWindow(
        { type: "SAVE_WINDOW", payload: { collectionName: name } },
        {} as chrome.runtime.MessageSender,
        storage,
      );
    }
  });

  chrome.runtime.onMessage.addListener(
    (
      message: BackgroundMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ) => {
      void dispatchMessage(message, sender).then(sendResponse);
      // Return true to signal that the response will be sent asynchronously
      return true;
    },
  );
});

async function dispatchMessage(
  message: BackgroundMessage,
  sender: chrome.runtime.MessageSender,
) {
  switch (message.type) {
    case "SAVE_WINDOW":
      return handleSaveWindow(message, sender, storage);
    case "RESTORE_COLLECTION":
      return handleRestoreCollection(message, sender, storage);
    case "AUTO_GROUP_WINDOW":
      return handleAutoGroupWindow(message, sender, storage);
    case "SYNC_NATIVE_GROUPS":
      return handleSyncNativeGroups(message, sender, storage);
    default: {
      const exhaustive: never = message;
      return {
        ok: false,
        error: `Unknown message type: ${JSON.stringify(exhaustive)}`,
      };
    }
  }
}
