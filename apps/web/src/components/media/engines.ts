import { ffmpegArgs, type VideoJob } from './geometry';
export type Engine = 'webcodecs' | 'ffmpeg';
export type Stage = { engine: Engine; step: 'loading' | 'encoding'; progress: number };
type Run = { file: File; job: Omit<VideoJob, 'input' | 'output'>; onStage: (stage: Stage) => void; signal: AbortSignal };
export const mimeTypes = { mp4: 'video/mp4', webm: 'video/webm' } as const;
class NeedsFallback extends Error {}

/** WebCodecs first (hardware encoders, small download); ffmpeg.wasm when this browser can't decode or encode the file. */
export async function compressVideo(run: Run): Promise<{ blob: Blob; engine: Engine }> {
  if (typeof VideoEncoder !== 'undefined') {
    try { return { blob: await viaMediabunny(run), engine: 'webcodecs' }; }
    catch (error) { if (!(error instanceof NeedsFallback)) throw error; }
  }
  return { blob: await viaFfmpeg(run), engine: 'ffmpeg' };
}

async function viaMediabunny({ file, job, onStage, signal }: Run) {
  const mb = await import('mediabunny');
  onStage({ engine: 'webcodecs', step: 'encoding', progress: 0 });
  const quality = new mb.Quality(job.quality);
  const size = job.size ?? job.crop ?? undefined;
  const codec = await mb.getFirstEncodableVideoCodec(job.format === 'mp4' ? ['avc'] : ['vp9', 'vp8'], { width: size?.width, height: size?.height, quality });
  if (!codec) throw new NeedsFallback();
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) });
  const output = new mb.Output({ format: job.format === 'mp4' ? new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) : new mb.WebMOutputFormat(), target: new mb.BufferTarget() });
  try {
    const conversion = await mb.Conversion.init({
      input, output, trim: { start: job.start, end: job.end },
      video: { rotate: job.rotation, crop: job.crop ? { left: job.crop.x, top: job.crop.y, width: job.crop.width, height: job.crop.height } : undefined, ...(job.size ? { width: job.size.width, height: job.size.height, fit: 'fill' as const } : {}), codec, quality, forceTranscode: true },
      audio: job.mute ? { discard: true } : { quality },
    });
    // Losing a track the user kept (e.g. audio this browser can't encode) is a reason to switch engines, not to ship a silent file.
    if (!conversion.isValid || conversion.discardedTracks.some(item => item.reason !== 'discarded_by_user' && (item.track.isVideoTrack() || item.track.isAudioTrack()))) throw new NeedsFallback();
    conversion.onProgress = progress => onStage({ engine: 'webcodecs', step: 'encoding', progress });
    const cancel = () => void conversion.cancel();
    signal.addEventListener('abort', cancel);
    try { await conversion.execute(); } finally { signal.removeEventListener('abort', cancel); }
    return new Blob([output.target.buffer!], { type: mimeTypes[job.format] });
  } catch (error) {
    if (signal.aborted) throw new DOMException('Canceled', 'AbortError');
    // Decoder errors on unusual codecs surface here; ffmpeg can usually still read the file.
    if (error instanceof NeedsFallback || (error instanceof Error && /decod|codec|unsupported/i.test(error.message))) throw new NeedsFallback();
    throw error;
  } finally { input.dispose(); }
}

async function viaFfmpeg({ file, job, onStage, signal }: Run) {
  onStage({ engine: 'ffmpeg', step: 'loading', progress: 0 });
  // ponytail: the 32 MB single-thread core is self-hosted and only downloaded when WebCodecs can't do the job; the multithreaded core needs cross-origin isolation headers.
  const [{ FFmpeg }, core, wasm] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/core?url'), import('@ffmpeg/core/wasm?url')]);
  const ffmpeg = new FFmpeg();
  const stop = () => ffmpeg.terminate();
  signal.addEventListener('abort', stop);
  try {
    await ffmpeg.load({ coreURL: core.default, wasmURL: wasm.default });
    const input = `input${file.name.match(/\.[a-z0-9]{1,5}$/i)?.[0] ?? ''}`, output = `output.${job.format}`;
    await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()));
    ffmpeg.on('progress', ({ progress }) => onStage({ engine: 'ffmpeg', step: 'encoding', progress: Math.min(Math.max(progress, 0), 1) }));
    onStage({ engine: 'ffmpeg', step: 'encoding', progress: 0 });
    if (await ffmpeg.exec(ffmpegArgs({ ...job, input, output })) !== 0) throw new Error('ffmpeg could not convert this file.');
    const data = await ffmpeg.readFile(output);
    return new Blob([data as Uint8Array<ArrayBuffer>], { type: mimeTypes[job.format] });
  } catch (error) {
    if (signal.aborted) throw new DOMException('Canceled', 'AbortError');
    throw error;
  } finally { signal.removeEventListener('abort', stop); ffmpeg.terminate(); }
}
