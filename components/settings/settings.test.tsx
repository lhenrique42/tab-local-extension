import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings } from "./Settings";
import { defaultRoot } from "../../lib/storage/defaults";
import type { StorageRoot } from "../../lib/storage/schema";

/* ------------------------------------------------------------------ */
/*  Module mocks                                                        */
/* ------------------------------------------------------------------ */

const mockUseStorage = vi.fn();
const mockStoragePatch = vi.fn();

const mockHandleExport = vi.fn();
const mockHandleImportFile = vi.fn();
let mockError: string | null = null;
let mockSuccess: string | null = null;

vi.mock("../../lib/hooks/useStorage", () => ({
    useStorage: () => mockUseStorage(),
}));

vi.mock("../../lib/storage/adapter", () => ({
    storage: {
        patch: (...args: unknown[]) => mockStoragePatch(...args),
        subscribe: vi.fn().mockReturnValue(() => {}),
    },
}));

vi.mock("../../composables/useImportExport", () => ({
    useImportExport: () => ({
        error: mockError,
        setError: (val: string | null) => {
            mockError = val;
        },
        success: mockSuccess,
        setSuccess: (val: string | null) => {
            mockSuccess = val;
        },
        handleExport: mockHandleExport,
        handleImportFile: mockHandleImportFile,
    }),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeRoot(
    overrides: Partial<StorageRoot["settings"]> = {},
): StorageRoot {
    const root = defaultRoot();
    root.settings = { ...root.settings, ...overrides };
    return root;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockStoragePatch.mockResolvedValue(undefined);
    mockUseStorage.mockReturnValue([makeRoot(), false]);

    mockError = null;
    mockSuccess = null;
    mockHandleExport.mockReset();
    mockHandleImportFile.mockReset();

    global.chrome = {
        storage: {
            local: {
                set: vi.fn().mockResolvedValue(undefined),
                get: vi.fn(),
            },
        },
    } as any;
});

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("Settings", () => {
    it("renders all three section headings", () => {
        render(<Settings />);
        expect(
            screen.getByRole("heading", { name: /restore/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: /integrations/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: /automation/i }),
        ).toBeInTheDocument();
    });

    it("shows loading state when loading is true", () => {
        mockUseStorage.mockReturnValue([makeRoot(), true]);
        render(<Settings />);
        expect(screen.getByLabelText(/loading settings/i)).toBeInTheDocument();
        expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    });

    // ── Restore mode ──

    it("renders restore mode radio options", () => {
        render(<Settings />);
        expect(
            screen.getByRole("radio", { name: /new window/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("radio", { name: /current window/i }),
        ).toBeInTheDocument();
    });

    it("calls storage.patch with correct restore mode when changed", async () => {
        render(<Settings />);
        await userEvent.click(
            screen.getByRole("radio", { name: /new window/i }),
        );
        await waitFor(() => expect(mockStoragePatch).toHaveBeenCalledOnce());
        const patchFn = mockStoragePatch.mock.calls[0][0];
        const draft = defaultRoot();
        patchFn(draft);
        expect(draft.settings.defaultRestoreMode).toBe("discard-background");
    });

    // ── nativeGroupSyncEnabled ──

    it("renders nativeGroupSyncEnabled toggle (off by default)", () => {
        render(<Settings />);
        const toggle = screen.getByRole("checkbox", {
            name: /sync native chrome tab groups/i,
        });
        expect(toggle).not.toBeChecked();
    });

    it("calls storage.patch with nativeGroupSyncEnabled=true when toggled on", async () => {
        render(<Settings />);
        const toggle = screen.getByRole("checkbox", {
            name: /sync native chrome tab groups/i,
        });
        await userEvent.click(toggle);
        await waitFor(() => expect(mockStoragePatch).toHaveBeenCalledOnce());
        const patchFn = mockStoragePatch.mock.calls[0][0];
        const draft = defaultRoot();
        patchFn(draft);
        expect(draft.settings.nativeGroupSyncEnabled).toBe(true);
    });

    // ── autoGroupByDomainEnabled ──

    it("renders autoGroupByDomainEnabled toggle (off by default)", () => {
        render(<Settings />);
        const toggle = screen.getByRole("checkbox", {
            name: /auto-group tabs by domain/i,
        });
        expect(toggle).not.toBeChecked();
    });

    it("calls storage.patch with autoGroupByDomainEnabled=true when toggled on", async () => {
        render(<Settings />);
        const toggle = screen.getByRole("checkbox", {
            name: /auto-group tabs by domain/i,
        });
        await userEvent.click(toggle);
        await waitFor(() => expect(mockStoragePatch).toHaveBeenCalledOnce());
        const patchFn = mockStoragePatch.mock.calls[0][0];
        const draft = defaultRoot();
        patchFn(draft);
        expect(draft.settings.autoGroupByDomainEnabled).toBe(true);
    });

    it("renders Export Data and Import Data sections", () => {
        render(<Settings />);
        expect(
            screen.getByRole("heading", { name: /export data/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: /import data/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /export/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /import file/i }),
        ).toBeInTheDocument();
    });

    it("calls handleExport when Export button is clicked", async () => {
        render(<Settings />);
        await userEvent.click(screen.getByRole("button", { name: /export/i }));
        expect(mockHandleExport).toHaveBeenCalledOnce();
    });

    it("triggers file input click when Import File button is clicked", async () => {
        render(<Settings />);
        const fileInput = screen.getByTestId("import-file-input");
        const clickSpy = vi.spyOn(fileInput, "click");
        await userEvent.click(
            screen.getByRole("button", { name: /import file/i }),
        );
        expect(clickSpy).toHaveBeenCalledOnce();
    });

    it("runs handleImportFile on file selection and opens ConfirmDialog when valid", async () => {
        const mockRoot = defaultRoot();
        mockHandleImportFile.mockResolvedValue(mockRoot);

        render(<Settings />);
        const fileInput = screen.getByTestId(
            "import-file-input",
        ) as HTMLInputElement;

        const file = new File(["{}"], "test.json", {
            type: "application/json",
        });
        await userEvent.upload(fileInput, file);

        expect(mockHandleImportFile).toHaveBeenCalledWith(file);

        // Dialog should appear
        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: /confirm import/i }),
            ).toBeInTheDocument();
        });
        expect(
            screen.getByText(
                "This will replace all your current data. Continue?",
            ),
        ).toBeInTheDocument();
    });

    it("sets storage and success message when import is confirmed", async () => {
        const mockRoot = defaultRoot();
        mockRoot.settings.theme = "dark";
        mockHandleImportFile.mockResolvedValue(mockRoot);

        render(<Settings />);
        const fileInput = screen.getByTestId(
            "import-file-input",
        ) as HTMLInputElement;
        const file = new File(["{}"], "test.json", {
            type: "application/json",
        });
        await userEvent.upload(fileInput, file);

        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: "Import" }),
            ).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole("button", { name: "Import" }));

        // Verify it saved
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
            __tablocal_root: mockRoot,
        });

        // Dialog should close
        expect(
            screen.queryByRole("heading", { name: /confirm import/i }),
        ).not.toBeInTheDocument();
    });

    it("does not save storage and closes dialog when import is cancelled", async () => {
        const mockRoot = defaultRoot();
        mockHandleImportFile.mockResolvedValue(mockRoot);

        render(<Settings />);
        const fileInput = screen.getByTestId(
            "import-file-input",
        ) as HTMLInputElement;
        const file = new File(["{}"], "test.json", {
            type: "application/json",
        });
        await userEvent.upload(fileInput, file);

        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: /cancel/i }),
            ).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

        expect(chrome.storage.local.set).not.toHaveBeenCalled();
        expect(
            screen.queryByRole("heading", { name: /confirm import/i }),
        ).not.toBeInTheDocument();
    });

    it("renders error message when error state is present", () => {
        mockError = "Invalid file structure";
        render(<Settings />);
        expect(screen.getByText("Invalid file structure")).toBeInTheDocument();
    });

    it("renders success message when success state is present", () => {
        mockSuccess = "Data imported successfully!";
        render(<Settings />);
        expect(
            screen.getByText("Data imported successfully!"),
        ).toBeInTheDocument();
    });
});
