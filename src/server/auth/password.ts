import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCallback);

const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keylen: 64
} as const;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(
    password,
    salt,
    SCRYPT_PARAMS.keylen
  )) as Buffer;

  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, n, r, p, salt, hash] = encodedHash.split('$');

  if (algorithm !== 'scrypt' || !n || !r || !p || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, 'hex');
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}
