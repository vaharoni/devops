import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyStr = process.env.MONOREPO_BASE_SECRET;
  if (!keyStr) throw new Error("MONOREPO_BASE_SECRET not set");
  // The secret is 32 random bytes stored as hex (64 chars) - decode it directly
  return Buffer.from(keyStr, "hex");
}

/**
 * Encrypts a plaintext string using AES-256-GCM with the given key.
 * @param plaintext 
 * @param key - The key to use for encryption. If not provided, the key will be derived from the MONOREPO_BASE_SECRET environment variable.
 * @returns The encrypted ciphertext.
 */
export function encryptAes256Gcm(plaintext: string, key?: Buffer): string {
  key ??= getKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all base64)
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypts a ciphertext string using AES-256-GCM with the given key.
 * @param ciphertext - The ciphertext to decrypt.
 * @param key - The key to use for decryption. If not provided, the key will be derived from the MONOREPO_BASE_SECRET environment variable.
 * @returns The decrypted plaintext.
 */
export function decryptAes256Gcm(ciphertext: string, key?: Buffer): string {
  key ??= getKey();
  const [ivB64, authTagB64, encryptedB64] = ciphertext.split(":");

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}
