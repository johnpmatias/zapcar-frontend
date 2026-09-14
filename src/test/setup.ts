import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// vitest.config.ts does not set `test.globals: true`, and test files import
// test functions explicitly from 'vitest' rather than relying on globals.
// @testing-library/react's auto-cleanup only registers itself when it finds
// a global `afterEach`, so without this it never runs and DOM from one test
// leaks into the next within the same file. Register it explicitly instead.
afterEach(() => {
  cleanup()
})
