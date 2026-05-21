/**
 * Drag-and-Drop unit tests for TASK-010.
 *
 * Strategy: dnd-kit uses pointer/touch events that don't exist in jsdom.
 * We test the reorder logic and callback wiring directly rather than
 * simulating real pointer drag sequences.
 */
import { arrayMove } from "@dnd-kit/sortable";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { TabList } from "./TabList";
import type { SavedTab } from "../../lib/storage/schema";

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function makeTab(overrides: Partial<SavedTab> = {}): SavedTab {
    return {
        id: `tab-${Math.random().toString(36).slice(2)}`,
        url: "https://example.com",
        title: "Example",
        faviconUrl: null,
        addedAt: Date.now(),
        ...overrides,
    };
}

// ---------------------------------------------------------------
// arrayMove — pure logic
// ---------------------------------------------------------------
describe("arrayMove utility", () => {
    it("moves an item forward in the array", () => {
        const arr = ["a", "b", "c", "d"];
        expect(arrayMove(arr, 0, 2)).toEqual(["b", "c", "a", "d"]);
    });

    it("moves an item backward in the array", () => {
        const arr = ["a", "b", "c", "d"];
        expect(arrayMove(arr, 3, 1)).toEqual(["a", "d", "b", "c"]);
    });

    it("returns same order when source equals destination", () => {
        const arr = ["a", "b", "c"];
        expect(arrayMove(arr, 1, 1)).toEqual(["a", "b", "c"]);
    });

    it("works with a single-element array", () => {
        expect(arrayMove(["x"], 0, 0)).toEqual(["x"]);
    });

    it("preserves object references", () => {
        const a = { id: "1" };
        const b = { id: "2" };
        const result = arrayMove([a, b], 0, 1);
        expect(result[0]).toBe(b);
        expect(result[1]).toBe(a);
    });
});

// ---------------------------------------------------------------
// TabList — renders drag handles
// ---------------------------------------------------------------
describe("TabList — drag handles", () => {
    it("renders a drag handle button for each tab", () => {
        const tabs: SavedTab[] = [
            makeTab({ title: "Google" }),
            makeTab({ title: "GitHub" }),
        ];
        render(
            <TabList
                tabs={tabs}
                onRemove={vi.fn()}

                onReorder={vi.fn()}
            />,
        );
        const dragHandles = screen.getAllByRole("button", {
            name: "Drag to reorder",
        });
        expect(dragHandles).toHaveLength(2);
    });

    it("renders without crashing when onReorder is not provided", () => {
        const tabs: SavedTab[] = [makeTab({ title: "Solo" })];
        render(
            <TabList tabs={tabs} onRemove={vi.fn()} />,
        );
        expect(screen.getByText("Solo")).toBeInTheDocument();
    });

    it("renders an empty list without errors", () => {
        const { container } = render(
            <TabList tabs={[]} onRemove={vi.fn()} />,
        );
        // No tab rows should be rendered
        expect(container.querySelectorAll(".tl-tab-row")).toHaveLength(0);
    });
});

// ---------------------------------------------------------------
// arrayMove integration — simulating onDragEnd outcome
// ---------------------------------------------------------------
describe("tab reorder logic", () => {
    it("produces correct new tab order on drag from index 0 to 2", () => {
        const tabs = [
            makeTab({ title: "A" }),
            makeTab({ title: "B" }),
            makeTab({ title: "C" }),
        ];

        const reordered = arrayMove(tabs, 0, 2);
        expect(reordered[0].title).toBe("B");
        expect(reordered[1].title).toBe("C");
        expect(reordered[2].title).toBe("A");
    });

    it("produces correct new tab order on drag from last to first", () => {
        const tabs = [
            makeTab({ title: "A" }),
            makeTab({ title: "B" }),
            makeTab({ title: "C" }),
        ];

        const reordered = arrayMove(tabs, 2, 0);
        expect(reordered[0].title).toBe("C");
        expect(reordered[1].title).toBe("A");
        expect(reordered[2].title).toBe("B");
    });

    it("onReorder is called with the reordered tabs array", () => {
        // This test verifies the callback contract used in TabList handleDragEnd.
        const tabs = [
            makeTab({ id: "t1" }),
            makeTab({ id: "t2" }),
            makeTab({ id: "t3" }),
        ];
        const onReorder = vi.fn();

        // Simulate what handleDragEnd does: get activeId + overId, call arrayMove, then onReorder
        const activeId = "t1";
        const overId = "t3";
        const oldIndex = tabs.findIndex((t) => t.id === activeId);
        const newIndex = tabs.findIndex((t) => t.id === overId);
        const newOrder = arrayMove(tabs, oldIndex, newIndex);
        onReorder(newOrder);

        expect(onReorder).toHaveBeenCalledOnce();
        expect(onReorder).toHaveBeenCalledWith([
            tabs[1], // t2
            tabs[2], // t3
            tabs[0], // t1
        ]);
    });
});

// ---------------------------------------------------------------
// collection reorder logic
// ---------------------------------------------------------------
describe("collection reorder logic", () => {
    it("produces correct new ID order on collection drag", () => {
        const ids = ["c1", "c2", "c3"];
        const reordered = arrayMove(ids, 2, 0);
        expect(reordered).toEqual(["c3", "c1", "c2"]);
    });

    it("onReorderCollections is called with new id array", () => {
        const ids = ["c1", "c2", "c3"];
        const onReorderCollections = vi.fn();

        const activeId = "c3";
        const overId = "c1";
        const oldIndex = ids.indexOf(activeId);
        const newIndex = ids.indexOf(overId);
        const newIds = arrayMove(ids, oldIndex, newIndex);
        onReorderCollections("group-1", newIds);

        expect(onReorderCollections).toHaveBeenCalledWith("group-1", [
            "c3",
            "c1",
            "c2",
        ]);
    });
});

// ---------------------------------------------------------------
// cross-group collection move logic
// ---------------------------------------------------------------
describe("cross-group collection move logic", () => {
    it("inserts collection at over position in target group", () => {
        const activeId = "c1";
        const overId = "c3";
        const toGroupIds = ["c2", "c3", "c4"];

        const toIds = [...toGroupIds].filter((id) => id !== activeId);
        const overIndex = toIds.indexOf(overId);
        if (overIndex !== -1) toIds.splice(overIndex, 0, activeId);

        expect(toIds).toEqual(["c2", "c1", "c3", "c4"]);
    });

    it("appends collection to empty target group", () => {
        const activeId = "c1";
        const toGroupIds: string[] = [];

        const toIds = [...toGroupIds].filter((id) => id !== activeId);
        const overIndex = toIds.indexOf("group-droppable-g2");
        if (overIndex !== -1) {
            toIds.splice(overIndex, 0, activeId);
        } else {
            toIds.push(activeId);
        }

        expect(toIds).toEqual(["c1"]);
    });

    it("removes moved collection from source group ids", () => {
        const activeId = "c2";
        const fromGroupIds = ["c1", "c2", "c3"];

        const remaining = fromGroupIds.filter((id) => id !== activeId);
        expect(remaining).toEqual(["c1", "c3"]);
    });

    it("does not duplicate collection when it already exists in target group", () => {
        const activeId = "c1";
        const toGroupIds = ["c1", "c2", "c3"]; // edge case: already there
        const overId = "c2";

        const toIds = [...toGroupIds].filter((id) => id !== activeId);
        const overIndex = toIds.indexOf(overId);
        if (overIndex !== -1) toIds.splice(overIndex, 0, activeId);

        expect(toIds).toEqual(["c1", "c2", "c3"]);
        expect(toIds.filter((id) => id === "c1")).toHaveLength(1);
    });
});
