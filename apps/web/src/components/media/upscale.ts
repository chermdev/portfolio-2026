export type UpscaleModel = 'fast' | 'quality';
export type UpscaleScale = 1 | 2 | 4;
export type Device = 'webgpu' | 'wasm';
export type Stage = { stage: 'download' | 'prepare' | 'enhance' | 'encode'; progress: number };
export type WorkerRequest = { bitmap: ImageBitmap; model: UpscaleModel; scale: UpscaleScale };
export type WorkerMessage = ({ type: 'stage' } & Stage) | { type: 'done'; blob: Blob; width: number; height: number; device: Device; ms: number } | { type: 'error'; message: string };
export type Upscaled = { blob: Blob; width: number; height: number; device: Device; ms: number; model: UpscaleModel; scale: UpscaleScale };

// The model enlarges ×4 internally, so the work (and memory) grows with the source. 2048 px → 8192 px is the ceiling.
export const maxSide = 2048;

/** Block windows of one fixed size (shifted inward at the edges) so WebGPU compiles its shaders once. */
export function windows(size: number, tile: number, pad: number) {
  const win = Math.min(size, tile + 2 * pad), out: { start: number; end: number; from: number; win: number }[] = [];
  for (let start = 0; start < size; start += tile) out.push({ start, end: Math.min(start + tile, size), from: Math.min(Math.max(start - pad, 0), size - win), win });
  return out;
}

// One worker, kept between runs so the model stays loaded on the GPU. Canceling terminates it.
let worker: Worker | null = null;
export async function upscale(file: Blob, model: UpscaleModel, scale: UpscaleScale, onStage: (stage: Stage) => void, signal: AbortSignal): Promise<Upscaled> {
  const bitmap = await createImageBitmap(file); // applies EXIF orientation
  worker ??= new Worker(new URL('./upscale.worker.ts', import.meta.url), { type: 'module' });
  const current = worker;
  return new Promise((resolve, reject) => {
    const stop = () => { current.terminate(); if (worker === current) worker = null; reject(new DOMException('Canceled', 'AbortError')); };
    if (signal.aborted) return stop();
    signal.addEventListener('abort', stop, { once: true });
    current.onerror = event => { signal.removeEventListener('abort', stop); current.terminate(); if (worker === current) worker = null; reject(new Error(event.message || 'Worker failed')); };
    current.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
      if (data.type === 'stage') return onStage(data);
      signal.removeEventListener('abort', stop);
      if (data.type === 'error') return reject(new Error(data.message));
      resolve({ blob: data.blob, width: data.width, height: data.height, device: data.device, ms: data.ms, model, scale });
    };
    current.postMessage({ bitmap, model, scale } satisfies WorkerRequest, [bitmap]);
  });
}

export async function detectDevice(): Promise<Device> {
  try { return (await (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu?.requestAdapter()) ? 'webgpu' : 'wasm'; } catch { return 'wasm'; }
}

// The last source and result live in IndexedDB so a reload doesn't lose a minute of GPU work. One record, replaced each time.
export type Saved = { source: Blob; name: string; result?: Upscaled };
const STORE = 'last';
function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('chermdev:upscaler', 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
// Storage can be unavailable (private mode, quota); the tool still works, it just won't survive a reload.
export const loadSaved = () => transact<Saved | undefined>('readonly', store => store.get(STORE)).catch(() => undefined);
export const save = (value: Saved) => transact('readwrite', store => store.put(value, STORE)).catch(() => undefined);
export const clearSaved = () => transact('readwrite', store => store.delete(STORE)).catch(() => undefined);
