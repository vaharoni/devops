import { beforeEach, describe, expect, it } from 'vitest';
import { sign, verify } from './secret';

describe('sign and verify', () => {
  beforeEach(() => {
    process.env.MONOREPO_BASE_SECRET = '1234567890abcdef';
  })

  it('verify should return true for correct signature', async () => {
    const sig = sign('data');
    expect(verify('data', sig)).toEqual(true);
  });

  it('verify should return false for correct signature', async () => {
    const sig = sign('data');
    expect(verify('data2', sig)).toEqual(false);
  });
});
