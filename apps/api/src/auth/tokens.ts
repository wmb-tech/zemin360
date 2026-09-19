import { createHash, randomBytes } from 'node:crypto';

/** Ham token yalnız kullanıcıya gider; DB'de hash durur. Sızan DB oturum vermez. */
export function newRawToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}
