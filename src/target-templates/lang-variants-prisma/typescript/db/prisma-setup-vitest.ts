import { afterEach, beforeEach, vi } from 'vitest';
import { prisma, rollbackTx, startTx } from './db-client-test';

/**
 * Vitest setup for Prisma transactional tests.
 *
 * Each test runs inside a transaction that is rolled back after the test completes,
 * ensuring test isolation without persisting data to the database.
 *
 * Usage:
 *   Create a `vitest.config.ts` in the project's folder:
 *
 *   import { defineConfig } from 'vitest/config'
 *   export default defineConfig({
 *     test: {
 *       setupFiles: ['../../db/prisma-setup-vitest.ts']  // adjust path as needed
 *     },
 *   })
 *
 * How it works:
 *   - db-client-test.ts creates a transactional Prisma client and stores it in globalThis.prismaGlobal
 *   - This is the same singleton key used by db/db-client.ts
 *   - All code importing from "db" gets the transactional client
 *   - beforeEach starts a transaction, afterEach rolls it back
 */

vi.mock('db', async () => {
  const prismaClient = await import('@prisma/client');
  return {
    ...prismaClient,
    prisma,
  };
});

beforeEach(async () => {
  await startTx();
});

afterEach(async () => {
  await rollbackTx();
});
