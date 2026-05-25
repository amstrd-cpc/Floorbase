import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions
} from 'crypto';

function scrypt(
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions
) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey as Buffer);
    });
  });
}

const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keylen: 64
} as const;

// Used in login route to keep response time constant when user not found,
// preventing timing-based email enumeration.
export const DUMMY_HASH =
  `scrypt$16384$8$1$` + '00'.repeat(16) + '$' + '00'.repeat(64);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p
  });

  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, n, r, p, salt, hash] = encodedHash.split('$');

  if (algorithm !== 'scrypt' || !n || !r || !p || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, 'hex');
  const actual = await scrypt(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p)
  });

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}
