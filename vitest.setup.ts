import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL auto-cleanup is only wired automatically when vitest globals are on;
// with explicit imports we must clean the DOM between component tests.
afterEach(() => {
  cleanup();
});
