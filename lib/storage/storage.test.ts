import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "@webext-core/fake-browser";
import { StorageAdapter } from "./adapter";
import { defaultRoot, SESSIONS_GROUP_ID } from "./defaults";
import { migrateRoot } from "./migrations";
import type { StorageRoot } from "./schema";

// Wire up the fake chrome global before each test
beforeEach(async () => {
  // fakeBrowser resets all storage on each call
  await fakeBrowser.storage.local.clear();
  vi.stubGlobal("chrome", fakeBrowser);
});

describe("StorageAdapter.read()", () => {
  it("returns defaultRoot() when storage is empty", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const adapter = new StorageAdapter();
    const result = await adapter.read();
    expect(result).toEqual(defaultRoot());
    vi.useRealTimers();
  });

  it("returns the stored root unchanged when version is current", async () => {
    const adapter = new StorageAdapter();
    const stored: StorageRoot = {
      __version: 1,
      groups: {
        [SESSIONS_GROUP_ID]: {
          id: SESSIONS_GROUP_ID,
          name: "Saved Sessions",
          color: "blue",
          collectionIds: [],
          createdAt: 1000,
          updatedAt: 1000,
        },
        g1: {
          id: "g1",
          name: "Work",
          color: "#ff0000",
          collectionIds: [],
          createdAt: 1000,
          updatedAt: 1000,
        },
      },
      collections: {},
      settings: defaultRoot().settings,
      groupOrder: [SESSIONS_GROUP_ID, "g1"],
    };
    await fakeBrowser.storage.local.set({ __tablocal_root: stored });

    const result = await adapter.read();
    expect(result).toEqual(stored);
  });

  it("runs migrations when __version is 0 and returns valid v1 root", async () => {
    const adapter = new StorageAdapter();
    // Store a "version 0" object (missing required fields)
    await fakeBrowser.storage.local.set({ __tablocal_root: { __version: 0 } });

    const result = await adapter.read();
    expect(result.__version).toBe(1);
    expect(result.groups).toHaveProperty(SESSIONS_GROUP_ID);
    expect(result.collections).toEqual({});
    expect(result.settings).toEqual(defaultRoot().settings);
  });

  it("runs migrations when __version is missing and returns valid v1 root", async () => {
    const adapter = new StorageAdapter();
    await fakeBrowser.storage.local.set({ __tablocal_root: {} });

    const result = await adapter.read();
    expect(result.__version).toBe(1);
    expect(result.groups).toBeDefined();
    expect(result.collections).toBeDefined();
  });
});

describe("StorageAdapter.patch()", () => {
  it("applies the mutation function and writes the result", async () => {
    const adapter = new StorageAdapter();

    await adapter.patch((draft) => {
      draft.settings.theme = "dark";
    });

    const stored = await fakeBrowser.storage.local.get("__tablocal_root");
    const root = stored["__tablocal_root"] as StorageRoot;
    expect(root.settings.theme).toBe("dark");
  });

  it("is idempotent when the function makes no changes", async () => {
    const adapter = new StorageAdapter();
    const before = await adapter.read();

    await adapter.patch(() => {
      // no-op
    });

    const after = await adapter.read();
    expect(after).toEqual(before);
  });
});

describe("StorageAdapter.subscribe()", () => {
  it("fires the callback with current value immediately on registration", async () => {
    const adapter = new StorageAdapter();
    const calls: StorageRoot[] = [];

    const unsub = adapter.subscribe((root) => calls.push(root));

    // Wait for the async initial read
    await new Promise((r) => setTimeout(r, 10));
    unsub();

    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].__version).toBe(1);
  });

  it("fires callback when storage changes for the matching key", async () => {
    const adapter = new StorageAdapter();
    const calls: StorageRoot[] = [];

    // Wait for initial call
    await new Promise((r) => setTimeout(r, 10));

    const unsub = adapter.subscribe((root) => calls.push(root));
    await new Promise((r) => setTimeout(r, 10));

    // Trigger a change through the adapter
    await adapter.patch((d) => {
      d.settings.autoGroupByDomainEnabled = true;
    });
    await new Promise((r) => setTimeout(r, 10));

    unsub();

    const flags = calls.map((r) => r.settings.autoGroupByDomainEnabled);
    expect(flags).toContain(true);
  });

  it("returns an unsubscribe function that stops future callbacks", async () => {
    const adapter = new StorageAdapter();
    const calls: StorageRoot[] = [];

    const unsub = adapter.subscribe((root) => calls.push(root));
    await new Promise((r) => setTimeout(r, 10));

    unsub();
    const countAfterUnsub = calls.length;

    await adapter.patch((d) => {
      d.settings.theme = "dark";
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(calls.length).toBe(countAfterUnsub);
  });
});

describe("migrateRoot()", () => {
  it("fills in missing groups, collections, settings with defaults", () => {
    const result = migrateRoot({});
    expect(result.groups).toHaveProperty(SESSIONS_GROUP_ID);
    expect(result.collections).toEqual({});
    expect(result.settings).toEqual(defaultRoot().settings);
    expect(result.__version).toBe(1);
    expect(result.groupOrder).toEqual([SESSIONS_GROUP_ID]);
  });

  it("drops unknown top-level keys", () => {
    const result = migrateRoot({
      __version: 1,
      groups: {},
      collections: {},
      settings: defaultRoot().settings,
      unknownKey: "should be gone",
    }) as unknown as Record<string, unknown>;

    expect("unknownKey" in result).toBe(false);
  });

  it("handles null input and returns defaultRoot", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    expect(migrateRoot(null)).toEqual(defaultRoot());
    vi.useRealTimers();
  });

  it("handles non-object input and returns defaultRoot", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    expect(migrateRoot("corrupt")).toEqual(defaultRoot());
    expect(migrateRoot(42)).toEqual(defaultRoot());
    vi.useRealTimers();
  });
});
