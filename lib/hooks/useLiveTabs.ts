import { useState, useEffect } from "react";
import { getCurrentWindowTabs } from "../chrome/tabs";
import type { TabInfo } from "../chrome/tabs";

/**
 * Returns the live list of tabs in the current window.
 * Re-queries whenever chrome.tabs events fire (created, removed, updated).
 */
export function useLiveTabs(): TabInfo[] {
    const [tabs, setTabs] = useState<TabInfo[]>([]);

    useEffect(() => {
        let cancelled = false;

        const refresh = () => {
            void getCurrentWindowTabs().then((result) => {
                if (!cancelled) setTabs(result);
            });
        };

        // Initial load
        refresh();

        // Attach Chrome tabs event listeners
        chrome.tabs.onCreated.addListener(refresh);
        chrome.tabs.onRemoved.addListener(refresh);
        chrome.tabs.onUpdated.addListener(refresh);
        chrome.tabs.onActivated.addListener(refresh);

        return () => {
            cancelled = true;
            chrome.tabs.onCreated.removeListener(refresh);
            chrome.tabs.onRemoved.removeListener(refresh);
            chrome.tabs.onUpdated.removeListener(refresh);
            chrome.tabs.onActivated.removeListener(refresh);
        };
    }, []);

    return tabs;
}
