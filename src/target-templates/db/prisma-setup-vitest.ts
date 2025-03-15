import { afterEach, beforeEach, vi } from 'vitest';
import { prisma, rollbackTx, startTx } from './db-client-test';

/**
 * Usage:
 *  Create a `vitest.config.ts` in the project's folder with the following content.
 *  Adjust the path to the setup file based on the nesting of the project's folder.
 
  import { defineConfig } from 'vitest/config'

  export default defineConfig({
    test: {
      setupFiles: ['../../db/prisma-setup-vitest.ts']
    },
  })
  
 */

vi.mock('db', () => ({ prisma }));

beforeEach(async () => {
  await startTx();
});

afterEach(async () => {
  await rollbackTx();
});
