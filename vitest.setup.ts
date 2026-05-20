import '@testing-library/jest-dom/vitest';
import * as vitestAxeMatchers from 'vitest-axe/matchers';
import { expect } from 'vitest';
expect.extend(vitestAxeMatchers);
