import { generateInternalAuthToken, parseInternalAuthTokenOrThrow } from "./internal-token";
export { encryptAes256Gcm as encrypt, decryptAes256Gcm as decrypt } from "./aes";

/** 
 * A simple token generation/verification class that relies on the subject field of an internal JWT-like token. It can:
 * - generate a short-lived (60s) token with the given subject
 * - verify that a token has not expired and bears the given subject
 * 
 * Relies on the MONOREPO_BASE_SECRET environment variable for signing and verifying the token.
 */
export class InternalToken {
  constructor(public subject: string) {}

  generate() {
    return generateInternalAuthToken({ sub: this.subject });
  }

  verifyOrThrow(token: string) {
    const parsedToken = parseInternalAuthTokenOrThrow(token);
    if (parsedToken.sub !== this.subject) {
      throw new Error('Invalid token');
    }
  }

  verifyFromHeaderOrThrow(authorizationHeader?: string | null) {
    if (!authorizationHeader) {
      throw new Error('Authorization header not found');
    }
    const token = authorizationHeader.replace('Bearer ', '');
    this.verifyOrThrow(token);
  }
}
