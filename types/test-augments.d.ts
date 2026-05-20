/// <reference path="../node_modules/@testing-library/jest-dom/types/vitest.d.ts" />

// Augment vitest's Assertion for vitest-axe (v0.1.0 ships Vitest 1.x namespace only).
declare module 'vitest' {
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
