/// <reference lib="webworker" />
// Real-ESRGAN (ONNX) on this device: WebGPU when available, WASM (CPU) otherwise. The model always enlarges ×4;
// ×2 and same-size outputs are the ×4 result scaled down, which keeps the recovered detail at the smaller size.
// The native WebGPU build: the older JSEP build left parts of the fast model on the CPU, 5× slower single-threaded
// (M1 Pro, 512 px: 1.8 s vs 9.2 s). Its WASM also covers the CPU fallback.
import * as ort from 'onnxruntime-web/webgpu';
import wasm from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import { windows, type UpscaleModel, type WorkerMessage, type WorkerRequest } from './upscale';

ort.env.wasm.wasmPaths = { wasm };
// ponytail: multithreaded WASM needs cross-origin isolation headers the site doesn't send; CPU runs single-threaded.
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(navigator.hardwareConcurrency || 4, 8) : 1;

const REVISION = '899dc1e4b22bbf1955c2f1739c085edc080cb366'; // pinned: weights never change under a cached URL
// `tile`: images run in blocks so GPU memory stays bounded. x4plus works at 64 channels × 4× resolution; on WebGPU,
// tensors past ~500 MB came back partly black with no error (M1 Pro, JSEP build: 416/512 broke, 320 worked), so it stays at 256.
const MODELS: Record<UpscaleModel, { file: string; tile: number }> = {
  fast: { file: 'realesr-general-x4v3.onnx', tile: 512 },
  quality: { file: 'realesrgan-x4plus.onnx', tile: 256 },
};
const SCALE = 4, PAD = 16;
const post = (message: WorkerMessage, transfer: Transferable[] = []) => self.postMessage(message, transfer);
let session: ort.InferenceSession | null = null, sessionKey = '';

async function modelBytes(model: UpscaleModel) {
  const url = `https://huggingface.co/jonathanst29/tinier-upscale-models/resolve/${REVISION}/${MODELS[model].file}`;
  const cache = await caches.open('chermdev:upscale-models:v1').catch(() => null);
  const hit = await cache?.match(url);
  if (hit) return new Uint8Array(await hit.arrayBuffer());
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Model download failed (${response.status})`);
  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); loaded += value.byteLength;
    post({ type: 'stage', stage: 'download', progress: total ? loaded / total : 0 });
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  await cache?.put(url, new Response(bytes)).catch(() => {}); // a full disk only costs a re-download next time
  return bytes;
}

async function backend(): Promise<'webgpu' | 'wasm'> {
  try { return (await navigator.gpu?.requestAdapter()) ? 'webgpu' : 'wasm'; } catch { return 'wasm'; }
}

async function load(model: UpscaleModel) {
  const device = await backend();
  if (session && sessionKey === `${model}:${device}`) return device;
  await session?.release(); session = null;
  const bytes = await modelBytes(model);
  post({ type: 'stage', stage: 'prepare', progress: 0 });
  try { session = await ort.InferenceSession.create(bytes, { executionProviders: [device], graphOptimizationLevel: 'all' }); sessionKey = `${model}:${device}`; return device; }
  catch (error) {
    if (device === 'wasm') throw error;
    // A GPU that can't build this graph still has a working CPU path.
    session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }); sessionKey = `${model}:wasm`; return 'wasm';
  }
}

async function enhance(pixels: ImageData, tile: number) {
  const { width, height, data } = pixels, outWidth = width * SCALE;
  const out = new Uint8ClampedArray(outWidth * height * SCALE * 4);
  const xs = windows(width, tile, PAD), ys = windows(height, tile, PAD), total = xs.length * ys.length;
  let done = 0;
  post({ type: 'stage', stage: 'enhance', progress: 0 });
  for (const y of ys) for (const x of xs) {
    const w = x.win, h = y.win, n = w * h, input = new Float32Array(3 * n);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const s = ((y.from + j) * width + x.from + i) * 4, d = j * w + i;
      input[d] = data[s] / 255; input[n + d] = data[s + 1] / 255; input[2 * n + d] = data[s + 2] / 255;
    }
    const result = await session!.run({ [session!.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, h, w]) });
    const tensor = result[session!.outputNames[0]], values = tensor.data as Float32Array;
    const tileWidth = w * SCALE, plane = tileWidth * h * SCALE;
    // Keep only the block's own pixels; the padding was context for the edges.
    for (let j = (y.start - y.from) * SCALE; j < (y.end - y.from) * SCALE; j++) {
      const row = (y.from * SCALE + j) * outWidth;
      for (let i = (x.start - x.from) * SCALE; i < (x.end - x.from) * SCALE; i++) {
        const s = j * tileWidth + i, d = (row + x.from * SCALE + i) * 4;
        out[d] = values[s] * 255; out[d + 1] = values[plane + s] * 255; out[d + 2] = values[2 * plane + s] * 255; out[d + 3] = 255;
      }
    }
    tensor.dispose();
    post({ type: 'stage', stage: 'enhance', progress: ++done / total });
  }
  return new ImageData(out, outWidth, height * SCALE);
}

async function run({ bitmap, model, scale }: WorkerRequest) {
  const started = performance.now();
  const device = await load(model);
  const { width, height } = bitmap;
  const source = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true })!;
  source.drawImage(bitmap, 0, 0);
  const original = source.getImageData(0, 0, width, height);
  const transparent = original.data.some((value, index) => index % 4 === 3 && value < 255);
  // The model only sees RGB. Transparent pixels are black underneath, which bleeds into edges; white bleeds less.
  if (transparent) { source.globalCompositeOperation = 'destination-over'; source.fillStyle = '#fff'; source.fillRect(0, 0, width, height); }
  const enhanced = await enhance(transparent ? source.getImageData(0, 0, width, height) : original, MODELS[model].tile);
  post({ type: 'stage', stage: 'encode', progress: 0 });
  let canvas = new OffscreenCanvas(enhanced.width, enhanced.height);
  canvas.getContext('2d')!.putImageData(enhanced, 0, 0);
  // Halve in steps: one large downscale skips pixels; halving averages them.
  for (let size = SCALE; size > scale; size /= 2) {
    const next = new OffscreenCanvas(canvas.width / 2, canvas.height / 2), context = next.getContext('2d')!;
    context.imageSmoothingQuality = 'high';
    context.drawImage(canvas, 0, 0, next.width, next.height);
    canvas = next;
  }
  if (transparent) {
    // Alpha comes from the original, smoothly resized to the output.
    const mask = new OffscreenCanvas(canvas.width, canvas.height).getContext('2d')!;
    mask.imageSmoothingQuality = 'high';
    mask.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const alpha = mask.getImageData(0, 0, canvas.width, canvas.height).data, context = canvas.getContext('2d')!;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < alpha.length; i += 4) pixels.data[i] = alpha[i];
    context.putImageData(pixels, 0, 0);
  }
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  post({ type: 'done', blob, width: canvas.width, height: canvas.height, device, ms: performance.now() - started });
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  run(event.data).catch(error => post({ type: 'error', message: error instanceof Error ? error.message : String(error) }));
};
