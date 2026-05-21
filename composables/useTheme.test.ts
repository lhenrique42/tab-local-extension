import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTheme, applyTheme } from "./useTheme";

beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
});

describe("useTheme", () => {
    it("always sets data-theme='dark' on mount", () => {
        renderHook(() => useTheme());
        expect(document.documentElement.getAttribute("data-theme")).toBe(
            "dark",
        );
    });

    it("applyTheme sets data-theme='dark'", () => {
        applyTheme();
        expect(document.documentElement.getAttribute("data-theme")).toBe(
            "dark",
        );
    });
});
