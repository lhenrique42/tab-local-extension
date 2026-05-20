// Side-effect import brings @testing-library/jest-dom augmentations into scope
// for all test files without needing vitest.setup.ts in tsconfig include.
import '@testing-library/jest-dom/vitest';

// vitest-axe v0.1.0 ships types for Vitest 1.x only; augment manually.
declare module 'vitest' {
  interface Assertion<T = unknown> {
    toHaveNoViolations(): T;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
