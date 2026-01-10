import { beforeEach, describe, expect, it } from 'vitest';
import { encryptAes256Gcm, decryptAes256Gcm } from './aes';

describe('AES-256-GCM encrypt and decrypt', () => {
  beforeEach(() => {
    // AES-256 requires a 32-byte key (64 hex characters)
    process.env.MONOREPO_BASE_SECRET = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  });

  it('should encrypt and decrypt a simple string', () => {
    const plaintext = 'hello world';
    const encrypted = encryptAes256Gcm(plaintext);
    const decrypted = decryptAes256Gcm(encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should encrypt and decrypt an empty string', () => {
    const plaintext = '';
    const encrypted = encryptAes256Gcm(plaintext);
    const decrypted = decryptAes256Gcm(encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should encrypt and decrypt unicode text', () => {
    const plaintext = '你好世界 🌍 héllo';
    const encrypted = encryptAes256Gcm(plaintext);
    const decrypted = decryptAes256Gcm(encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should produce different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'same input';
    const encrypted1 = encryptAes256Gcm(plaintext);
    const encrypted2 = encryptAes256Gcm(plaintext);
    expect(encrypted1).not.toEqual(encrypted2);
    // But both should decrypt to the same value
    expect(decryptAes256Gcm(encrypted1)).toEqual(plaintext);
    expect(decryptAes256Gcm(encrypted2)).toEqual(plaintext);
  });

  it('should produce ciphertext in expected format (iv:authTag:ciphertext)', () => {
    const encrypted = encryptAes256Gcm('test');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    // All parts should be valid base64
    parts.forEach((part) => {
      expect(() => Buffer.from(part, 'base64')).not.toThrow();
    });
  });

  it('should throw on tampered ciphertext', () => {
    const encrypted = encryptAes256Gcm('sensitive data');
    const [iv, authTag, ciphertext] = encrypted.split(':');
    const tamperedCiphertext = `${iv}:${authTag}:${ciphertext.slice(0, -1)}x`;
    expect(() => decryptAes256Gcm(tamperedCiphertext)).toThrow();
  });

  it('should throw on tampered auth tag', () => {
    const encrypted = encryptAes256Gcm('sensitive data');
    const [iv, _authTag, ciphertext] = encrypted.split(':');
    // Use a completely different auth tag (all zeros)
    const fakeAuthTag = Buffer.alloc(16, 0).toString('base64');
    const tamperedTag = `${iv}:${fakeAuthTag}:${ciphertext}`;
    expect(() => decryptAes256Gcm(tamperedTag)).toThrow();
  });
});
