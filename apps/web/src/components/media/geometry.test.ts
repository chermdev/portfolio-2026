import test from 'node:test';
import assert from 'node:assert/strict';
import { centeredRect, fitSize, ffmpegArgs, moveRect, resizeFromCorner, rotatedSize, snapRect } from './geometry.ts';

const frame = { width: 1920, height: 1080 };
test('crop rectangles stay inside the frame and keep their ratio', () => {
  assert.deepEqual(rotatedSize(frame, 90), { width: 1080, height: 1920 });
  assert.deepEqual(centeredRect(frame, 1), { x: 420, y: 0, width: 1080, height: 1080 });
  assert.deepEqual(moveRect({ x: 420, y: 0, width: 1080, height: 1080 }, 1000, -50, frame), { x: 840, y: 0, width: 1080, height: 1080 });
  // Dragging the corner past the frame edge stops at the edge, and the square stays square.
  const square = resizeFromCorner({ x: 1000, y: 500 }, { x: 3000, y: 900 }, frame, 1);
  assert.deepEqual(square, { x: 1000, y: 500, width: 580, height: 580 });
  // Dragging up-left from the anchor grows toward the origin.
  assert.deepEqual(resizeFromCorner({ x: 100, y: 100 }, { x: 40, y: 70 }, frame, null), { x: 40, y: 70, width: 60, height: 30 });
  assert.deepEqual(snapRect({ x: 10.6, y: 3.2, width: 101.7, height: 57.9 }, frame, true), { x: 11, y: 3, width: 100, height: 56 });
});
test('resizing only shrinks and can keep even sides for video', () => {
  assert.deepEqual(fitSize({ width: 4000, height: 3000 }, 2000), { width: 2000, height: 1500 });
  assert.deepEqual(fitSize({ width: 800, height: 600 }, 2000), { width: 800, height: 600 });
  assert.deepEqual(fitSize({ width: 1081, height: 607 }, 854, true), { width: 854, height: 480 });
});
test('ffmpeg fallback applies the same edits in the same order', () => {
  const args = ffmpegArgs({ input: 'in', output: 'out.mp4', format: 'mp4', quality: 'medium', start: 2, end: 8, duration: 10, rotation: 90, crop: { x: 0, y: 10, width: 100, height: 200 }, size: { width: 50, height: 100 }, mute: true });
  assert.deepEqual(args.slice(0, 6), ['-ss', '2.000', '-to', '8.000', '-i', 'in']);
  assert.equal(args[args.indexOf('-vf') + 1], 'transpose=1,crop=100:200:0:10,scale=50:100,format=yuv420p');
  assert.ok(args.includes('-an') && args.includes('libx264') && args.at(-1) === 'out.mp4');
  const full = ffmpegArgs({ input: 'in', output: 'out.webm', format: 'webm', quality: 'high', start: 0, end: 10, duration: 10, rotation: 0, crop: null, size: null, mute: false });
  assert.equal(full[0], '-i');
  assert.ok(full.includes('libvpx-vp9') && full.includes('libopus') && !full.includes('-movflags'));
});
