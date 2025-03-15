import { getConst } from '../../libs/config';
import { sign, verify } from './secret';

export type InternalTokenClaims<CustomClaims extends object = object> =
  CustomClaims & {
    /** The token issuer */
    iss: string;
    /** Issued at */
    iat: number;
    /** Expires at */
    exp: number;
    /** The subject of the token. Should contain a string of the "service account" who bears the token. */
    sub?: string;
    /** The audience of the token. Should contain a string of who the token is intended for. */
    aud?: string;
  };

class InternalTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InternalTokenError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function defaultClaims({
  expiresInSeconds,
  sub,
  aud,
}: {
  expiresInSeconds: number;
  sub?: string;
  aud?: string;
}): InternalTokenClaims {
  return {
    iss: `${getConst('project-name')}-internal`,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    sub,
    aud,
  };
}

export function generateInternalAuthToken({
  customClaims = {},
  expiresInSeconds = 60,
  sub,
  aud,
}: {
  customClaims?: Record<string, string>;
  expiresInSeconds?: number;
  sub?: string;
  aud?: string;
} = {}) {
  const data = {
    ...customClaims,
    // This should be after the customClaims so that custom claims cannot override the default claims
    ...defaultClaims({ expiresInSeconds, sub, aud }),
  };
  const str = JSON.stringify(data);
  const encodedData = Buffer.from(str).toString('base64');
  const signature = sign(encodedData);
  return `${encodedData}.${signature}`;
}

export function parseInternalAuthTokenOrThrow<CustomClaims extends object = object>(
  token: string,
): InternalTokenClaims<CustomClaims> {
  const [encodedData, signature] = token.split('.');
  const isSignatureOk = verify(encodedData, signature);
  if (!isSignatureOk) {
    throw new InternalTokenError('Invalid token');
  }
  const dataStr = Buffer.from(encodedData, 'base64').toString('utf-8');
  const data: InternalTokenClaims<CustomClaims> = JSON.parse(dataStr);

  if (data.exp < Math.floor(Date.now() / 1000)) {
    throw new InternalTokenError('Token expired');
  }

  return data;
}