import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Settings } from "./Settings";
import { defaultRoot } from "../../lib/storage/defaults";
import type { StorageRoot } from "../../lib/storage/schema";

// Mock the hook subscription to avoid triggering background storage listeners during test
vi.mock("../../lib/hooks/useStorage", () => ({
    useStorage: () => {
        const root = defaultRoot();
        root.groups = {
            "group-1": {
                id: "group-1",
                name: "My Group",
                color: "blue",
                collectionIds: ["col-1"],
            },
        };
        root.collections = {
            "col-1": { id: "col-1", name: "My Collection", tabIds: [] },
        };
        root.settings.defaultRestoreMode = "active-all";
        return [root, false];
    },
}));

describe("Settings E2E Integration - Data Portability", () => {
    let localStore: Record<string, any> = {};
    let exportedBlob: Blob | null = null;

    beforeEach(() => {
        vi.clearAllMocks();
        localStore = {};
        exportedBlob = null;

        global.chrome = {
            storage: {
                local: {
                    get: vi.fn().mockImplementation(async (key: string) => {
                        return { [key]: localStore[key] };
                    }),
                    set: vi
                        .fn()
                        .mockImplementation(
                            async (data: Record<string, any>) => {
                                Object.assign(localStore, data);
                            },
                        ),
                    clear: vi.fn().mockImplementation(async () => {
                        localStore = {};
                    }),
                },
            },
        } as any;

        global.URL.createObjectURL = vi
            .fn()
            .mockImplementation((blob: Blob) => {
                exportedBlob = blob;
                return "blob:mock-url";
            });
        global.URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("runs E2E flow: export data -> clear storage -> import exported file -> data restored", async () => {
        // 1. Seed initial data
        const seedRoot = defaultRoot();
        seedRoot.groups = {
            "group-1": {
                id: "group-1",
                name: "E2E Group",
                color: "tg-blue",
                collectionIds: ["col-1"],
            },
        };
        seedRoot.collections = {
            "col-1": {
                id: "col-1",
                name: "E2E Collection",
                tabIds: ["tab-1"],
            },
        };
        seedRoot.settings.defaultRestoreMode = "active-all";

        localStore["__tablocal_root"] = seedRoot;

        // Spy on anchor elements to prevent actual navigations/downloads
        const clickMock = vi.fn();
        const mockAnchor = document.createElement("a");
        mockAnchor.click = clickMock;

        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation((tagName) => {
            if (tagName === "a") {
                return mockAnchor;
            }
            return originalCreateElement(tagName);
        });

        // Render the Settings panel
        render(<Settings />);

        // 2. Click Export to download the data
        const exportButton = screen.getByRole("button", { name: /export/i });
        await userEvent.click(exportButton);

        // Verify file generated correctly
        expect(clickMock).toHaveBeenCalledOnce();
        expect(exportedBlob).toBeTruthy();

        const exportedBlobContent = await exportedBlob!.text();
        expect(exportedBlobContent).toBeTruthy();
        const parsedExport = JSON.parse(exportedBlobContent) as StorageRoot;
        expect(parsedExport.groups["group-1"].name).toBe("E2E Group");
        expect(parsedExport.collections["col-1"].name).toBe("E2E Collection");

        // 3. Clear our storage
        await chrome.storage.local.clear();
        expect(localStore["__tablocal_root"]).toBeUndefined();

        // 4. Upload the exported file
        const fileInput = screen.getByTestId(
            "import-file-input",
        ) as HTMLInputElement;
        const file = new File([exportedBlobContent], "tablocal-export.json", {
            type: "application/json",
        });

        await userEvent.upload(fileInput, file);

        // 5. Confirm the overwrite dialog
        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: "Import" }),
            ).toBeInTheDocument();
        });
        await userEvent.click(screen.getByRole("button", { name: "Import" }));

        // 6. Verify data has been correctly restored to local storage
        const restoredRoot = localStore["__tablocal_root"] as StorageRoot;
        expect(restoredRoot).toBeDefined();
        expect(restoredRoot.groups["group-1"].name).toBe("E2E Group");
        expect(restoredRoot.collections["col-1"].name).toBe("E2E Collection");
        expect(restoredRoot.settings.defaultRestoreMode).toBe("active-all");

        // Ensure success message is shown
        expect(
            screen.getByText("Data imported successfully!"),
        ).toBeInTheDocument();
    });
});
