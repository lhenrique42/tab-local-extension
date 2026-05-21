import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useImportExport } from "./useImportExport";
import { storage } from "../lib/storage/adapter";
import { defaultRoot } from "../lib/storage/defaults";
import type { StorageRoot } from "../lib/storage/schema";

vi.mock("../lib/storage/adapter", () => ({
    storage: {
        read: vi.fn(),
    },
}));

describe("useImportExport", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock URL methods which are not implemented in JSDOM
        global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
        global.URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("exportData", () => {
        it("reads from storage, creates a blob, and triggers browser download", async () => {
            const mockRoot = defaultRoot();
            vi.mocked(storage.read).mockResolvedValue(mockRoot);

            const appendChildSpy = vi.spyOn(document.body, "appendChild");
            const removeChildSpy = vi.spyOn(document.body, "removeChild");

            const mockAnchor = document.createElement("a");
            const clickMock = vi.fn();
            mockAnchor.click = clickMock;

            const originalCreateElement = document.createElement.bind(document);
            const createElementSpy = vi
                .spyOn(document, "createElement")
                .mockImplementation((tagName) => {
                    if (tagName === "a") {
                        return mockAnchor;
                    }
                    return originalCreateElement(tagName);
                });

            const { result } = renderHook(() => useImportExport());

            await act(async () => {
                await result.current.handleExport();
            });

            expect(storage.read).toHaveBeenCalledOnce();
            expect(global.URL.createObjectURL).toHaveBeenCalledOnce();

            // Filename date format tablocal-export-YYYY-MM-DD.json
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const day = String(now.getDate()).padStart(2, "0");
            const expectedFilename = `tablocal-export-${year}-${month}-${day}.json`;

            expect(createElementSpy).toHaveBeenCalledWith("a");
            expect(mockAnchor.download).toBe(expectedFilename);
            expect(appendChildSpy).toHaveBeenCalled();
            expect(clickMock).toHaveBeenCalledOnce();
            expect(removeChildSpy).toHaveBeenCalled();
            expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(
                "blob:mock-url",
            );
        });
    });

    describe("importData", () => {
        it("resolves with migrated root when file contains valid TabLocal JSON", async () => {
            const mockRoot = defaultRoot();
            mockRoot.settings.theme = "dark";
            const fileContent = JSON.stringify(mockRoot);
            const file = new File([fileContent], "backup.json", {
                type: "application/json",
            });

            const { result } = renderHook(() => useImportExport());

            let importedRoot: StorageRoot | undefined;
            await act(async () => {
                importedRoot = await result.current.handleImportFile(file);
            });

            expect(importedRoot).toBeDefined();
            if (importedRoot) {
                expect(importedRoot.__version).toBe(1);
                expect(importedRoot.settings.theme).toBe("dark");
            }
            expect(result.current.error).toBeNull();
        });

        it("rejects and sets error when file content is not valid JSON", async () => {
            const file = new File(["invalid json text"], "backup.json", {
                type: "application/json",
            });

            const { result } = renderHook(() => useImportExport());

            await act(async () => {
                await expect(
                    result.current.handleImportFile(file),
                ).rejects.toThrow();
            });

            expect(result.current.error).toBeTruthy();
        });

        it("rejects and sets error when file is a JSON object but lacks TabLocal structure", async () => {
            const unrelatedObj = { foo: "bar", hello: "world" };
            const file = new File(
                [JSON.stringify(unrelatedObj)],
                "backup.json",
                { type: "application/json" },
            );

            const { result } = renderHook(() => useImportExport());

            await act(async () => {
                await expect(
                    result.current.handleImportFile(file),
                ).rejects.toThrow("Invalid TabLocal import file structure");
            });

            expect(result.current.error).toBe(
                "Invalid TabLocal import file structure",
            );
        });
    });
});
