import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestDatabase } from '@/server/db/testing/test-db';

let teardown: () => Promise<void>;
let checkRateLimit: typeof import('@/server/rate-limit').checkRateLimit;

before(async () => {
  const db = await setupTestDatabase();
  teardown = db.teardown;
  process.env.DATABASE_URL = db.url;

  ({ checkRateLimit } = await import('@/server/rate-limit'));
});

after(async () => {
  await teardown();
});

function uniqueKey(label: string) {
  return `${label}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test('allows requests under the limit and blocks once the limit is hit', async () => {
  const key = uniqueKey('under-limit');

  const first = await checkRateLimit({ key, limit: 3, windowMs: 60_000 });
  const second = await checkRateLimit({ key, limit: 3, windowMs: 60_000 });
  const third = await checkRateLimit({ key, limit: 3, windowMs: 60_000 });
  const fourth = await checkRateLimit({ key, limit: 3, windowMs: 60_000 });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, true);
  assert.equal(fourth.allowed, false);
  assert.equal(fourth.remaining, 0);
});

test('resets the count once the window has elapsed', async () => {
  const key = uniqueKey('window-reset');

  const first = await checkRateLimit({ key, limit: 1, windowMs: 50 });
  assert.equal(first.allowed, true);

  const blocked = await checkRateLimit({ key, limit: 1, windowMs: 50 });
  assert.equal(blocked.allowed, false);

  await new Promise((resolve) => setTimeout(resolve, 100));

  const afterWindow = await checkRateLimit({ key, limit: 1, windowMs: 50 });
  assert.equal(afterWindow.allowed, true);
});

test('different keys are tracked independently', async () => {
  const keyA = uniqueKey('key-a');
  const keyB = uniqueKey('key-b');

  await checkRateLimit({ key: keyA, limit: 1, windowMs: 60_000 });
  const blockedA = await checkRateLimit({ key: keyA, limit: 1, windowMs: 60_000 });
  const allowedB = await checkRateLimit({ key: keyB, limit: 1, windowMs: 60_000 });

  assert.equal(blockedA.allowed, false);
  assert.equal(allowedB.allowed, true);
});

test('concurrent increments on the same key never exceed the limit', async () => {
  const key = uniqueKey('concurrent');
  const limit = 5;

  const results = await Promise.all(
    Array.from({ length: 20 }, () => checkRateLimit({ key, limit, windowMs: 60_000 }))
  );

  const allowedCount = results.filter((result) => result.allowed).length;
  assert.equal(allowedCount, limit, 'exactly `limit` requests should be let through, not more');
});
