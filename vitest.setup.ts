import "@testing-library/jest-dom/vitest";
import * as vitestAxeMatchers from "vitest-axe/matchers";
import { expect } from "vitest";
expect.extend(vitestAxeMatchers);

// jsdom's Blob does not implement .text() — polyfill using FileReader
if (typeof Blob !== "undefined" && !Blob.prototype.text) {
    Blob.prototype.text = function (): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(this);
        });
    };
}
