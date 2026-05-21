import type { BackgroundMessage, BackgroundResponse } from "./types";

/**
 * Sends a typed message to the background service worker.
 * Wraps chrome.runtime.sendMessage with the BackgroundMessage union.
 */
export async function sendToBackground<T = unknown>(
    msg: BackgroundMessage,
): Promise<BackgroundResponse<T>> {
    try {
        const response = await chrome.runtime.sendMessage<
            BackgroundMessage,
            BackgroundResponse<T>
        >(msg);
        return response;
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
