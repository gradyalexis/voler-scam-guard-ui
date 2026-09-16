import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { authSecret } from './owner';

/**
 * Enkripsi access token Discord sebelum disimpan di database (AES-256-GCM).
 * Kunci diturunkan dari AUTH_SECRET: mengganti AUTH_SECRET membuat token lama
 * tidak bisa dibuka lagi, dan user cukup login ulang.
 */
function key(): Buffer {
  return createHash('sha256').update(`vsg-discord-token:${authSecret()}`).digest();
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
}

/** null kalau format rusak atau kunci sudah berganti. */
export function unseal(sealed: string): string | null {
  const [version, iv, tag, data] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}
