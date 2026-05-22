import { defineConfig } from "wxt";

export default defineConfig({
    modules: ["@wxt-dev/module-react"],
    manifest: {
        name: "TabLocal",
        description:
            "On-device tab manager. Save, organise, and restore your browser sessions.",
        version: "1.0.1",
        icons: {
            16: "icons/16.png",
            32: "icons/32.png",
            48: "icons/48.png",
            128: "icons/128.png",
        },
        permissions: [
            "tabs",
            "tabGroups",
            "storage",
            "favicon",
            "unlimitedStorage",
        ],
        web_accessible_resources: [
            {
                resources: ["_favicon/*"],
                matches: ["chrome://newtab/*"],
            },
        ],
        commands: {
            "save-window": {
                suggested_key: {
                    default: "Ctrl+Shift+S",
                    mac: "Command+Shift+S",
                },
                description: "Save current window as a collection",
            },
        },
        chrome_url_overrides: {
            newtab: "newtab.html",
        },
    },
});
