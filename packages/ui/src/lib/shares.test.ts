import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleShares, cellCounts } from './shares.ts';

test('thin parts stay visible and cells always add up', () => {
  assert.deepEqual(visibleShares([99, 1]).map(share => Math.round(share * 100)), [92, 8]);
  assert.deepEqual(cellCounts([99.6, 0.4], 100), [99, 1]);
  assert.deepEqual(cellCounts([45, 55], 64), [29, 35]);
  assert.deepEqual(cellCounts([1, 0], 10), [10, 0]);
  for (const [a, b] of [[1, 2], [3, 997], [50, 50]]) assert.equal(cellCounts([a, b], 58).reduce((x, y) => x + y), 58);
});
