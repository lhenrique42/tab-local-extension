import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTheme } from "./useTheme";

/* ------------------------------------------------------------------ */
/*  Mock storage adapter                                                */
/* ------------------------------------------------------------------ */

const mockStorageSubscribe = vi.fn();
const mockStorageRead = vi.fn();

vi.mock("../lib/storage/adapter", () => ({
  storage: {
    subscribe: (...args: unknown[]) => mockStorageSubscribe(...args),
    read: (...args: unknown[]) => mockStorageRead(...args),
  },
}));

/* ------------------------------------------------------------------ */
/*  matchMedia helper                                                   */
/* ------------------------------------------------------------------ */

function stubMatchMedia(prefersDark: boolean) {
  const listeners: Array<(e: { matches: boolean }) => void> = [];
  const mq = {
    matches: prefersDark,
    addEventListener: vi.fn(
      (_: string, fn: (e: { matches: boolean }) => void) => {
        listeners.push(fn);
      },
    ),
    removeEventListener: vi.fn(),
    _trigger: (matches: boolean) => listeners.forEach((fn) => fn({ matches })),
  };
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(mq));
  return mq;
}

/* ------------------------------------------------------------------ */
/*  Setup                                                               */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.clearAllMocks();
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("useTheme", () => {
  it("sets data-theme='dark' when UserSettings.theme is 'dark'", () => {
    stubMatchMedia(false);
    mockStorageSubscribe.mockImplementation((cb: (r: unknown) => void) => {
      cb({ settings: { theme: "dark" } });
      return () => {};
    });

    renderHook(() => useTheme());

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("sets data-theme='light' when UserSettings.theme is 'light'", () => {
    stubMatchMedia(false);
    mockStorageSubscribe.mockImplementation((cb: (r: unknown) => void) => {
      cb({ settings: { theme: "light" } });
      return () => {};
    });

    renderHook(() => useTheme());

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("resolves 'system' to 'dark' when prefers-color-scheme is dark", () => {
    stubMatchMedia(true);
    mockStorageSubscribe.mockImplementation((cb: (r: unknown) => void) => {
      cb({ settings: { theme: "system" } });
      return () => {};
    });

    renderHook(() => useTheme());

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("resolves 'system' to 'light' when prefers-color-scheme is light", () => {
    stubMatchMedia(false);
    mockStorageSubscribe.mockImplementation((cb: (r: unknown) => void) => {
      cb({ settings: { theme: "system" } });
      return () => {};
    });

    renderHook(() => useTheme());

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("cleans up subscriber and media query listener on unmount", () => {
    const mq = stubMatchMedia(false);
    const unsub = vi.fn();
    mockStorageSubscribe.mockImplementation((cb: (r: unknown) => void) => {
      cb({ settings: { theme: "dark" } });
      return unsub;
    });

    const { unmount } = renderHook(() => useTheme());
    unmount();

    expect(unsub).toHaveBeenCalledOnce();
    expect(mq.removeEventListener).toHaveBeenCalledOnce();
  });

  it("re-applies theme when OS color scheme changes while theme is 'system'", async () => {
    const mq = stubMatchMedia(false); // starts light
    mockStorageSubscribe.mockImplementation((cb: (r: unknown) => void) => {
      cb({ settings: { theme: "system" } });
      return () => {};
    });
    mockStorageRead.mockResolvedValue({ settings: { theme: "system" } });

    renderHook(() => useTheme());

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    // OS switches to dark
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ ...mq, matches: true }),
    );
    mq._trigger(true);

    // Wait for the async storage.read + applyTheme
    await new Promise((r) => setTimeout(r, 10));

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
