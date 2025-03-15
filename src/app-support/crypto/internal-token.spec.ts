import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateInternalAuthToken, parseInternalAuthTokenOrThrow } from './internal-token';

vi.mock('../../libs/config', () => ({
  getConst: () => 'test',
}));

describe('generate and verify internal token', () => {
  beforeEach(() => {
    process.env.MONOREPO_BASE_SECRET = '1234567890abcdef';
  })

  it('works for default tokens', () => {
    const token = generateInternalAuthToken();
    const parsedPayload = parseInternalAuthTokenOrThrow(token);
    expect(parsedPayload.iss).toEqual('test-internal');
    expect(parsedPayload.exp - parsedPayload.iat).toEqual(60);
  });

  it('works for custom tokens', () => {
    const payload = { hello: 'world' };
    const token = generateInternalAuthToken({
      customClaims: payload,
      expiresInSeconds: 30,
      aud: 'aud',
      sub: 'sub',
    });
    const parsedPayload = parseInternalAuthTokenOrThrow<{
      hello: string;
    }>(token);
    expect(parsedPayload.iss).toEqual('test-internal');
    expect(parsedPayload.exp - parsedPayload.iat).toEqual(30);
    expect(parsedPayload.hello).toEqual('world');
    expect(parsedPayload.aud).toEqual('aud');
    expect(parsedPayload.sub).toEqual('sub');
  });

  it('throws for expired tokens', () => {
    const invalidToken = generateInternalAuthToken({
      expiresInSeconds: -1,
    });
    expect(() => parseInternalAuthTokenOrThrow(invalidToken)).toThrowError('Token expired');
  });

  it('throws for invalid signature', () => {
    const payload = { hello: 'world' };
    const token = generateInternalAuthToken({
      customClaims: payload,
    });
    const invalidToken = token.replace(/.$/, 'x');
    expect(() => parseInternalAuthTokenOrThrow(invalidToken)).toThrowError('Invalid token');
  });
});
