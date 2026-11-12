import test from 'node:test';
import assert from 'node:assert/strict';
import { windows } from './upscale.ts';

test('upscale blocks cover every pixel once, with one window size inside the image', () => {
  for (const [size, tile] of [[1024, 256], [1000, 256], [300, 512], [257, 256], [32, 256]]) {
    const blocks = windows(size, tile, 16);
    const covered = new Array(size).fill(0);
    for (const block of blocks) {
      assert.equal(block.win, Math.min(size, tile + 32));
      assert.ok(block.from >= 0 && block.from + block.win <= size, 'window stays inside the image');
      assert.ok(block.from <= block.start && block.end <= block.from + block.win, 'block sits inside its window');
      for (let i = block.start; i < block.end; i++) covered[i]++;
    }
    assert.ok(covered.every(count => count === 1), `${size}/${tile}: every pixel kept exactly once`);
  }
});
