import { useEffect, useRef, useState } from 'react';
import { LocaleProvider, useTranslation } from '@portfolio/i18n/react';
import { type Locale } from '@portfolio/i18n';
import { Cpu, Download, ImageUpscale, RotateCcw, ShieldCheck, WandSparkles, X, Zap } from 'lucide-react';
import { Button } from '@portfolio/ui/components/button';
import { Field, FieldLabel, FieldDescription } from '@portfolio/ui/components/field';
import { Progress } from '@portfolio/ui/components/progress';
import { ToggleGroup, ToggleGroupItem } from '@portfolio/ui/components/toggle-group';
import { useHydrateCalculator, useUpscaleStore } from '../../stores/calculators';
import { Dropzone, downloadBlob } from './MediaEditor';
import { CompareView } from './CompareView';
import { formatBytes } from './geometry';
import { clearSaved, detectDevice, loadSaved, maxSide, save, upscale, type Device, type Stage, type Upscaled, type UpscaleModel, type UpscaleScale } from './upscale';

type Source = { blob: Blob; name: string; url: string; width: number; height: number };
type Result = Upscaled & { url: string };

function ImageUpscalerContent() {
  const { t, locale } = useTranslation();
  const tag = locale === 'es' ? 'es-MX' : 'en-US';
  useHydrateCalculator(useUpscaleStore);
  const { values, set, reset } = useUpscaleStore();
  const model = values.upscaleModel as UpscaleModel, scale = Number(values.upscaleScale) as UpscaleScale;
  const [source, setSource] = useState<Source | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState('');
  const [device, setDevice] = useState<Device | null>(null);
  const abort = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);
  const resultPane = useRef<HTMLElement>(null);
  const objectUrl = (blob: Blob) => { const url = URL.createObjectURL(blob); urls.current.push(url); return url; };
  const releaseUrls = () => { urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current = []; };

  async function open(blob: Blob, name: string) {
    let size: { width: number; height: number };
    try { const bitmap = await createImageBitmap(blob); size = { width: bitmap.width, height: bitmap.height }; bitmap.close(); }
    catch { setError(t("This browser can’t read this image.")); return false; }
    if (Math.max(size.width, size.height) > maxSide) { setError(t('This image is {width} × {height} px. Enhancing works up to {max} px on the longest side; resize it first.', { width: size.width, height: size.height, max: maxSide })); return false; }
    abort.current?.abort();
    releaseUrls();
    setSource({ blob, name, url: objectUrl(blob), ...size });
    setResult(null); setError('');
    return true;
  }

  // Bring back the last image and result after a reload.
  useEffect(() => {
    void detectDevice().then(setDevice);
    void loadSaved().then(async saved => {
      if (!saved || !(await open(saved.source, saved.name)) || !saved.result) return;
      setResult({ ...saved.result, url: objectUrl(saved.result.blob) });
    });
    return () => { abort.current?.abort(); releaseUrls(); };
  }, []);

  async function choose(files: File[]) {
    const file = files.find(item => item.type.startsWith('image/') || /\.(heic|heif|avif)$/i.test(item.name));
    if (!file) return;
    if (await open(file, file.name)) void save({ source: file, name: file.name });
  }

  async function enhance() {
    if (!source) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setError(''); setStage({ stage: 'prepare', progress: 0 });
    // On phones the result sits below the options; bring the progress into view.
    if (resultPane.current && resultPane.current.getBoundingClientRect().top > innerHeight * 0.6) resultPane.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const output = await upscale(source.blob, model, scale, setStage, controller.signal);
      setResult({ ...output, url: objectUrl(output.blob) });
      void save({ source: source.blob, name: source.name, result: output });
    } catch (err) {
      if (!controller.signal.aborted) setError(t('This image couldn’t be enhanced: {reason}', { reason: (err as Error).message }));
    } finally { if (abort.current === controller) { abort.current = null; setStage(null); } }
  }

  function startOver() {
    abort.current?.abort();
    releaseUrls();
    setSource(null); setResult(null); setError(''); setStage(null);
    reset();
    void clearSaved();
  }

  const working = stage !== null;
  const outdated = result && (result.model !== model || result.scale !== scale);
  const dims = (width: number, height: number) => t('{width} × {height} px', { width, height });
  const scaleLabel = (value: UpscaleScale) => value === 1 ? t("Same size") : `×${value}`;
  const stageText = !stage ? '' : stage.stage === 'download' ? t('Downloading the model, only the first time · {progress}', { progress: `${Math.round(stage.progress * 100)}%` })
    : stage.stage === 'prepare' ? (device === 'webgpu' ? t("Preparing the GPU…") : t("Preparing…"))
    : stage.stage === 'enhance' ? t('Enhancing · {progress}', { progress: `${Math.round(stage.progress * 100)}%` }) : t("Saving the result…");
  const download = () => result && source && downloadBlob(result.url, `${source.name.replace(/\.[^.]+$/, '')}-enhanced${result.scale === 1 ? '' : `-x${result.scale}`}.png`);

  return <div className="tool-workspace">
    <aside className="tool-pane-inputs" aria-label={t("Inputs")}>
      <Dropzone accept="image/*,.heic,.heif" onFiles={choose}><span className="font-medium text-foreground">{source ? t("Choose another image") : t("Drop an image or choose a file")}</span><span className="meta">{t('JPEG, PNG, WebP · up to {max} px', { max: maxSide })}</span></Dropzone>
      <Field><FieldLabel id="upscale-model">{t("Mode")}</FieldLabel>
        <ToggleGroup type="single" variant="outline" className="grid w-full grid-cols-2" aria-labelledby="upscale-model" value={model} onValueChange={value => { if (value) set('upscaleModel', value as UpscaleModel); }} disabled={working}>
          <ToggleGroupItem value="fast" className="h-11 sm:h-9"><Zap aria-hidden="true" /> {t("Fast")}</ToggleGroupItem>
          <ToggleGroupItem value="quality" className="h-11 sm:h-9"><WandSparkles aria-hidden="true" /> {t("Best quality")}</ToggleGroupItem>
        </ToggleGroup>
        <FieldDescription>{model === 'fast' ? t("Good for most images. Takes seconds on a recent computer.") : t("Recovers more detail in skin, hair, and textures. Takes several times longer and downloads 67 MB the first time.")}</FieldDescription></Field>
      <Field><FieldLabel id="upscale-scale">{t("Final size")}</FieldLabel>
        <ToggleGroup type="single" variant="outline" className="grid w-full grid-cols-3" aria-labelledby="upscale-scale" value={String(scale)} onValueChange={value => { if (value) set('upscaleScale', value as '1' | '2' | '4'); }} disabled={working}>
          {([1, 2, 4] as UpscaleScale[]).map(value => <ToggleGroupItem key={value} value={String(value)} className="h-11 sm:h-9">{scaleLabel(value)}</ToggleGroupItem>)}
        </ToggleGroup>
        <FieldDescription>{source ? <span className="tabular-nums">{dims(source.width, source.height)} → {dims(source.width * scale, source.height * scale)}</span> : scale === 1 ? t("Keeps the resolution and only improves sharpness.") : t("Enlarges the image and fills in detail.")}</FieldDescription></Field>
      {working
        ? <Button variant="outline" size="lg" className="h-11" onClick={() => abort.current?.abort()}><X data-icon="inline-start" /> {t("Cancel")}</Button>
        : <Button size="lg" className="h-11" disabled={!source} onClick={enhance}><WandSparkles data-icon="inline-start" /> {result && !outdated ? t("Enhance again") : t("Enhance image")}</Button>}
      {device && <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Cpu aria-hidden="true" className="mt-0.5 shrink-0" size={16} /> {device === 'webgpu' ? t("Runs on this device’s GPU.") : t("This browser can’t use the GPU (WebGPU), so the processor does the work and it takes much longer. Chrome or Edge use the GPU.")}</p>}
      <div className="mt-auto flex flex-col items-start gap-3 border-t pt-5"><p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={16} /> {t("Images are enhanced on this device and never uploaded. The last image, its result, and your options are saved here.")}</p><Button variant="ghost" size="sm" className="-ml-2.5 h-11 sm:h-8" onClick={startOver} disabled={!source && model === 'fast' && scale === 2}><RotateCcw aria-hidden="true" /> {t("Start over")}</Button></div>
    </aside>
    <section ref={resultPane} className="tool-pane-result scroll-mt-4" aria-label={t("Enhanced image")}>
      {!source ? <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
        <ImageUpscale aria-hidden="true" size={28} strokeWidth={1.5} /><p className="font-medium text-foreground">{t("No image yet")}</p>
        <p className="max-w-sm text-sm">{t("Add an AI-generated or low-resolution image on the left, then enhance it. You’ll compare the before and after here.")}</p>
        {error && <p className="mt-2 max-w-sm text-sm text-destructive">{error}</p>}
      </div> : <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div aria-live="polite"><h2 className="meta">{result ? t("Enhanced") : t("Original")}</h2>
            <p className="result-value mt-1">{result ? dims(result.width, result.height) : dims(source.width, source.height)}</p>
            <p className="text-xs text-muted-foreground">{result ? t('From {size} · {scale} · {seconds} s', { size: dims(source.width, source.height), scale: scaleLabel(result.scale), seconds: Math.max(1, Math.round(result.ms / 1000)) }) : t("Not enhanced yet")}</p></div>
          {result && <Button disabled={working} onClick={download}><Download data-icon="inline-start" /> {t('Download PNG · {size}', { size: formatBytes(result.blob.size, tag) })}</Button>}
        </div>
        {stage && <div aria-live="polite" className="flex flex-col gap-2"><Progress value={stage.progress * 100} aria-label={t("Progress")} /><p className="meta">{stageText}</p></div>}
        {error && <p className="rounded-xl border p-4 text-sm text-destructive">{error}</p>}
        {outdated && !working && <p className="rounded-xl border bg-secondary/40 p-4 text-sm">{t("You changed the options. Enhance again to apply them; the result below still uses the previous ones.")}</p>}
        <CompareView before={source.url} after={result?.url ?? null} width={result?.width ?? source.width} height={result?.height ?? source.height} label={source.name} />
        {result && <dl className="receipt max-w-md text-sm">
          <div className="receipt-row"><dt>{t("Original")}</dt><dd>{dims(source.width, source.height)}</dd></div>
          <div className="receipt-row"><dt>{t("Enhanced")}</dt><dd>{dims(result.width, result.height)}</dd></div>
          <div className="receipt-row"><dt>{t("Mode")}</dt><dd>{result.model === 'fast' ? t("Fast") : t("Best quality")}</dd></div>
          <div className="receipt-row"><dt>{t("Processed on")}</dt><dd>{result.device === 'webgpu' ? 'GPU' : 'CPU'}</dd></div>
          <div className="receipt-row"><dt>{t("File")}</dt><dd>PNG · {formatBytes(result.blob.size, tag)}</dd></div>
        </dl>}
      </div>}
    </section>
  </div>;
}

export default function ImageUpscaler({ locale = 'en' }: { locale?: Locale }) {
  return <LocaleProvider locale={locale}><ImageUpscalerContent /></LocaleProvider>;
}
