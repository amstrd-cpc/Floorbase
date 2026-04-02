import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseBestTable } from './table-assignment';

test('chooseBestTable picks smallest fitting active table', () => {
  const choice = chooseBestTable(
    [
      { id: 't1', label: 'T1', capacityMin: null, capacityMax: 6, isActive: true },
      { id: 't2', label: 'T2', capacityMin: null, capacityMax: 4, isActive: true },
      { id: 't3', label: 'T3', capacityMin: null, capacityMax: 2, isActive: true }
    ],
    3
  );

  assert.equal(choice?.id, 't2');
});

test('chooseBestTable ignores inactive and below-minimum tables', () => {
  const choice = chooseBestTable(
    [
      { id: 't1', label: 'T1', capacityMin: 4, capacityMax: 4, isActive: true },
      { id: 't2', label: 'T2', capacityMin: null, capacityMax: 4, isActive: false },
      { id: 't3', label: 'T3', capacityMin: null, capacityMax: 6, isActive: true }
    ],
    3
  );

  assert.equal(choice?.id, 't3');
});
