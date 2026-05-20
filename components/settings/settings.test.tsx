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

vi.mock("../../lib/hooks/useStorage", () => ({
  useStorage: () => mockUseStorage(),
}));

vi.mock("../../lib/storage/adapter", () => ({
  storage: {
    patch: (...args: unknown[]) => mockStoragePatch(...args),
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeRoot(overrides: Partial<StorageRoot["settings"]> = {}): StorageRoot {
  const root = defaultRoot();
  root.settings = { ...root.settings, ...overrides };
  return root;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStoragePatch.mockResolvedValue(undefined);
  mockUseStorage.mockReturnValue([makeRoot(), false]);
});

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("Settings", () => {
  it("renders all four section headings", () => {
    render(<Settings />);
    expect(screen.getByRole("heading", { name: /appearance/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /restore/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /integrations/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /automation/i })).toBeInTheDocument();
  });

  it("shows loading state when loading is true", () => {
    mockUseStorage.mockReturnValue([makeRoot(), true]);
    render(<Settings />);
    expect(screen.getByLabelText(/loading settings/i)).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  // ── Theme ──

  it("renders theme radio options: Dark, Light, System", () => {
    render(<Settings />);
    expect(screen.getByRole("radio", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "System" })).toBeInTheDocument();
  });

  it("checks the current theme radio (dark by default)", () => {
    render(<Settings />);
    expect(screen.getByRole("radio", { name: "Dark" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
  });

  it("checks 'Light' when theme is light", () => {
    mockUseStorage.mockReturnValue([makeRoot({ theme: "light" }), false]);
    render(<Settings />);
    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
  });

  it("calls storage.patch with { theme: 'light' } when Light is selected", async () => {
    render(<Settings />);
    await userEvent.click(screen.getByRole("radio", { name: "Light" }));
    await waitFor(() => expect(mockStoragePatch).toHaveBeenCalledOnce());
    const patchFn = mockStoragePatch.mock.calls[0][0];
    const draft = defaultRoot();
    patchFn(draft);
    expect(draft.settings.theme).toBe("light");
  });

  it("calls storage.patch with { theme: 'dark' } when Dark is selected", async () => {
    mockUseStorage.mockReturnValue([makeRoot({ theme: "light" }), false]);
    render(<Settings />);
    await userEvent.click(screen.getByRole("radio", { name: "Dark" }));
    await waitFor(() => expect(mockStoragePatch).toHaveBeenCalledOnce());
    const patchFn = mockStoragePatch.mock.calls[0][0];
    const draft = defaultRoot();
    patchFn(draft);
    expect(draft.settings.theme).toBe("dark");
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
      screen.getByRole("radio", { name: /current window/i }),
    );
    await waitFor(() => expect(mockStoragePatch).toHaveBeenCalledOnce());
    const patchFn = mockStoragePatch.mock.calls[0][0];
    const draft = defaultRoot();
    patchFn(draft);
    expect(draft.settings.defaultRestoreMode).toBe("active-all");
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
});
