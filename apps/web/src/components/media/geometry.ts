// Pure geometry and command building shared by the image and video tools.
// Every rectangle is in source pixels of the frame *after* rotation, which is the order
// both canvas drawing and Mediabunny apply (rotate → crop → resize).
export type Rect = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };
export type Rotation = 0 | 90 | 180 | 270;
export const MIN_CROP = 16;

export const rotatedSize = ({ width, height }: Size, rotation: Rotation): Size => rotation % 180 ? { width: height, height: width } : { width, height };

/** The largest rectangle with this aspect ratio (width ÷ height), centered in the frame. No ratio covers the whole frame. */
export function centeredRect(frame: Size, ratio: number | null): Rect {
  if (!ratio) return { x: 0, y: 0, width: frame.width, height: frame.height };
  const width = Math.min(frame.width, frame.height * ratio), height = width / ratio;
  return { x: (frame.width - width) / 2, y: (frame.height - height) / 2, width, height };
}

/** Moves a rectangle, keeping it inside the frame. */
export function moveRect(rect: Rect, dx: number, dy: number, frame: Size): Rect {
  return { ...rect, x: Math.min(Math.max(rect.x + dx, 0), frame.width - rect.width), y: Math.min(Math.max(rect.y + dy, 0), frame.height - rect.height) };
}

/** Resizes from a dragged corner: the opposite corner stays put, the result stays inside the frame and keeps the ratio. */
export function resizeFromCorner(anchor: { x: number; y: number }, pointer: { x: number; y: number }, frame: Size, ratio: number | null): Rect {
  const left = pointer.x < anchor.x, up = pointer.y < anchor.y;
  const roomX = left ? anchor.x : frame.width - anchor.x, roomY = up ? anchor.y : frame.height - anchor.y;
  let width = Math.min(Math.max(Math.abs(pointer.x - anchor.x), MIN_CROP), roomX);
  let height = Math.min(Math.max(Math.abs(pointer.y - anchor.y), MIN_CROP), roomY);
  if (ratio) {
    // Follow whichever side the pointer pulled further, then shrink both to fit.
    width = Math.max(width, height * ratio); height = width / ratio;
    const fit = Math.min(1, roomX / width, roomY / height);
    width *= fit; height *= fit;
  }
  return { x: left ? anchor.x - width : anchor.x, y: up ? anchor.y - height : anchor.y, width, height };
}

/** Whole pixels, inside the frame. `even` rounds sizes down to even numbers, which H.264 requires. */
export function snapRect(rect: Rect, frame: Size, even = false): Rect {
  const step = even ? 2 : 1;
  const x = Math.min(Math.max(Math.round(rect.x), 0), frame.width - step), y = Math.min(Math.max(Math.round(rect.y), 0), frame.height - step);
  const width = Math.max(step, Math.floor(Math.min(rect.width, frame.width - x) / step) * step);
  const height = Math.max(step, Math.floor(Math.min(rect.height, frame.height - y) / step) * step);
  return { x, y, width, height };
}

/** Scales down so the longest side is at most `maxSide` (never up). `even` keeps both sides even. */
export function fitSize(size: Size, maxSide: number | null, even = false): Size {
  const scale = maxSide ? Math.min(1, maxSide / Math.max(size.width, size.height)) : 1;
  const round = (value: number) => even ? Math.max(2, Math.round(value / 2) * 2) : Math.max(1, Math.round(value));
  return { width: round(size.width * scale), height: round(size.height * scale) };
}

export type VideoJob = { input: string; output: string; format: 'mp4' | 'webm'; quality: 'low' | 'medium' | 'high'; start: number; end: number; duration: number; rotation: Rotation; crop: Rect | null; size: Size | null; mute: boolean };
const crf = { mp4: { low: 32, medium: 27, high: 22 }, webm: { low: 42, medium: 36, high: 30 } };
/** ffmpeg arguments for the compatibility engine; the same edits Mediabunny applies, in the same order. */
export function ffmpegArgs(job: VideoJob): string[] {
  const trim = [...(job.start > 0 ? ['-ss', job.start.toFixed(3)] : []), ...(job.end < job.duration ? ['-to', job.end.toFixed(3)] : [])];
  const filters = [...({ 0: [], 90: ['transpose=1'], 180: ['hflip', 'vflip'], 270: ['transpose=2'] }[job.rotation]),
    ...(job.crop ? [`crop=${job.crop.width}:${job.crop.height}:${job.crop.x}:${job.crop.y}`] : []),
    ...(job.size ? [`scale=${job.size.width}:${job.size.height}`] : []), 'format=yuv420p'];
  const video = job.format === 'mp4' ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf.mp4[job.quality])] : ['-c:v', 'libvpx-vp9', '-crf', String(crf.webm[job.quality]), '-b:v', '0', '-deadline', 'realtime', '-cpu-used', '8'];
  const audio = job.mute ? ['-an'] : job.format === 'mp4' ? ['-c:a', 'aac', '-b:a', '128k'] : ['-c:a', 'libopus', '-b:a', '96k'];
  return [...trim, '-i', job.input, '-vf', filters.join(','), ...video, ...audio, ...(job.format === 'mp4' ? ['-movflags', '+faststart'] : []), job.output];
}

export const formatBytes = (bytes: number, locale: string) => {
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.max(0, Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024))));
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: index ? 1 : 0 }).format(bytes / 1024 ** index)} ${units[index]}`;
};
