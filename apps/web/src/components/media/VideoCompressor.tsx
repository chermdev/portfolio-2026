import { useEffect, useRef, useState } from 'react';
import { LocaleProvider, useTranslation } from '@portfolio/i18n/react';
import { type Locale } from '@portfolio/i18n';
import { Download, Pause, Play, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { Button } from '@portfolio/ui/components/button';
import { Field, FieldLabel, FieldDescription } from '@portfolio/ui/components/field';
import { Slider } from '@portfolio/ui/components/slider';
import { Switch } from '@portfolio/ui/components/switch';
import { Progress } from '@portfolio/ui/components/progress';
import { Alert, AlertTitle, AlertDescription } from '@portfolio/ui/components/alert';
import { ToggleGroup, ToggleGroupItem } from '@portfolio/ui/components/toggle-group';
import { useHydrateCalculator, useVideoStore } from '../../stores/calculators';
import { SelectField, Insights } from '../calculators/Fields';
import { CropEditor, Dropzone, EditControls, downloadBlob, noEdits, renamed, sizeChange, type Edits } from './MediaEditor';
import { fitSize, rotatedSize, snapRect } from './geometry';
import type { Engine, Stage } from './engines';

type Source = { file: File; url: string; width: number; height: number; duration: number };
type Output = { key: string; blob: Blob; url: string; engine: Engine; format: 'mp4' | 'webm'; width: number; height: number };
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;

function VideoCompressorContent() {
  const { t, locale } = useTranslation();
  const tag = locale === 'es' ? 'es-MX' : 'en-US';
  useHydrateCalculator(useVideoStore);
  const { values: settings, set, reset } = useVideoStore();
  const video = useRef<HTMLVideoElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [edits, setEdits] = useState<Edits>(noEdits);
  const [trim, setTrim] = useState<[number, number]>([0, 0]);
  const [playing, setPlaying] = useState(false);
  const [tick, setTick] = useState(0);
  const [stage, setStage] = useState<Stage | null>(null);
  const [output, setOutput] = useState<Output | null>(null);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);

  function load(files: File[]) {
    const file = files.find(item => item.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(item.name));
    if (!file) return;
    abort.current?.abort();
    if (source) URL.revokeObjectURL(source.url);
    if (output) URL.revokeObjectURL(output.url);
    setOutput(null); setError(''); setEdits(noEdits); setPlaying(false);
    setSource({ file, url: URL.createObjectURL(file), width: 0, height: 0, duration: 0 });
  }
  useEffect(() => () => { abort.current?.abort(); }, []);

  // Paint the current frame while playing, and loop inside the trimmed range.
  useEffect(() => {
    if (!playing) return;
    let frame = requestAnimationFrame(function paint() {
      const element = video.current;
      if (element && element.currentTime >= trim[1]) element.currentTime = trim[0];
      setTick(value => value + 1);
      frame = requestAnimationFrame(paint);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, trim]);
  const toggle = () => { const element = video.current; if (!element) return; if (element.paused) { if (element.currentTime < trim[0] || element.currentTime >= trim[1]) element.currentTime = trim[0]; void element.play(); } else element.pause(); };

  const size = source && source.width ? { width: source.width, height: source.height } : null;
  const frame = size ? rotatedSize(size, edits.rotation) : null;
  const crop = frame && edits.crop ? snapRect(edits.crop, frame, true) : null;
  const target = frame ? fitSize(crop ?? frame, Number(settings.videoMaxSide) || null, true) : null;
  const resized = target && frame && (target.width !== (crop ?? frame).width || target.height !== (crop ?? frame).height) ? target : null;
  const format = settings.videoFormat as 'mp4' | 'webm';
  const job = source && frame ? { format, quality: settings.videoQuality as 'low' | 'medium' | 'high', start: trim[0], end: trim[1], duration: source.duration, rotation: edits.rotation, crop, size: resized, mute: settings.mute } : null;
  const key = JSON.stringify(job);
  const stale = output && output.key !== key;

  async function compress() {
    if (!source || !job || !target) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    video.current?.pause();
    setError(''); setStage({ engine: 'webcodecs', step: 'loading', progress: 0 });
    try {
      const { compressVideo } = await import('./engines');
      const { blob, engine } = await compressVideo({ file: source.file, job, onStage: setStage, signal: controller.signal });
      if (output) URL.revokeObjectURL(output.url);
      setOutput({ key, blob, engine, format: job.format, url: URL.createObjectURL(blob), ...target });
    } catch (err) {
      if (!controller.signal.aborted) { console.error(err); setError(t("This video couldn’t be compressed.")); } // ponytail: engine errors are English-only; the raw one goes to the console
    } finally { if (abort.current === controller) { abort.current = null; setStage(null); } }
  }

  const change = output ? sizeChange(source!.file.size, output.blob.size, tag) : null;
  const working = stage !== null;
  const qualityLabels = { low: t("Smallest"), medium: t("Balanced"), high: t("Quality") };
  const sizeLabels: Record<string, string> = { '0': t("Original size"), '1920': '1080p · 1920 px', '1280': '720p · 1280 px', '854': '480p · 854 px' };

  return <div className="tool-workspace">
    <aside className="tool-pane-inputs" aria-label={t("Inputs")}>
      {/* With nothing loaded, the large drop target in the result pane takes over on desktop. */}
      <Dropzone accept="video/*,.mkv,.mov" onFiles={load} className={source ? undefined : 'lg:hidden'}><span className="font-medium text-foreground">{source ? t("Choose another video") : t("Drop a video or choose a file")}</span><span className="meta">{source ? source.file.name : t("MP4, MOV, WebM and more")}</span></Dropzone>
      <Field><FieldLabel id="video-format">{t("Convert to")}</FieldLabel><ToggleGroup type="single" variant="outline" className="grid w-full grid-cols-2" aria-labelledby="video-format" value={format} onValueChange={value => { if (value) set('videoFormat', value); }}>
        <ToggleGroupItem value="mp4" className="h-11 sm:h-9">MP4 · H.264</ToggleGroupItem><ToggleGroupItem value="webm" className="h-11 sm:h-9">WebM · VP9</ToggleGroupItem>
      </ToggleGroup><FieldDescription>{format === 'mp4' ? t("Plays almost everywhere.") : t("Smaller at the same quality, but not every device plays it.")}</FieldDescription></Field>
      <Field><FieldLabel id="video-quality">{t("Compression")}</FieldLabel><ToggleGroup type="single" variant="outline" className="grid w-full grid-cols-3" aria-labelledby="video-quality" value={settings.videoQuality} onValueChange={value => { if (value) set('videoQuality', value); }}>
        {(['low', 'medium', 'high'] as const).map(value => <ToggleGroupItem key={value} value={value} className="h-auto min-h-11 whitespace-normal py-2 sm:min-h-9">{qualityLabels[value]}</ToggleGroupItem>)}
      </ToggleGroup></Field>
      <SelectField label={t("Resize: longest side")} value={settings.videoMaxSide} onChange={value => set('videoMaxSide', value)} options={['0', '1920', '1280', '854'].map(value => ({ value, label: sizeLabels[value] }))} />
      <Field orientation="horizontal"><FieldLabel htmlFor="video-mute" className="flex-1">{t("Remove audio")}</FieldLabel><Switch id="video-mute" checked={settings.mute} onCheckedChange={value => set('mute', value)} /></Field>
      <div className="mt-auto flex flex-col items-start gap-3 border-t pt-5"><p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={16} /> {t("Videos are processed on this device and never uploaded. Settings are saved here.")}</p><Button variant="ghost" size="sm" className="-ml-2.5 h-11 sm:h-8" onClick={reset}><RotateCcw aria-hidden="true" /> {t("Reset settings")}</Button></div>
    </aside>
    <section className={source ? 'tool-pane-result' : 'tool-pane-result max-lg:hidden'} aria-label={t("Compressed video")}>
      {source && <video ref={video} src={source.url} className="sr-only" aria-hidden="true" tabIndex={-1} playsInline preload="auto"
        onLoadedMetadata={event => { const element = event.currentTarget; setSource(previous => previous && { ...previous, width: element.videoWidth, height: element.videoHeight, duration: element.duration }); setTrim([0, element.duration]); }}
        onLoadedData={() => setTick(value => value + 1)} onSeeked={() => setTick(value => value + 1)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onError={() => setError(t("This browser can’t preview this video. You can still try to compress it."))} />}
      {!source ? <Dropzone accept="video/*,.mkv,.mov" onFiles={load} className="h-full min-h-64"><span className="font-medium text-foreground">{t("Drop a video or choose a file")}</span><span className="meta">{t("MP4, MOV, WebM and more")}</span><span className="mt-2 max-w-sm">{t("Trim, crop, rotate and compress it here.")}</span></Dropzone> : <div className="flex flex-col gap-8">
        <div className="grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_16rem] @3xl:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            {size ? <CropEditor source={video.current} size={size} edits={edits} onCrop={value => setEdits({ ...edits, crop: value })} tick={tick} label={t('Preview of {name}', { name: source.file.name })} /> : <div className="crop-stage min-h-48 w-full" />}
            {source.duration > 0 && <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3"><Button type="button" size="icon" variant="outline" className="size-11 sm:size-9" onClick={toggle} aria-label={playing ? t("Pause") : t("Play")}>{playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}</Button>
                <p className="meta tabular-nums">{t('Keep {start} – {end} · {length}', { start: clock(trim[0]), end: clock(trim[1]), length: clock(trim[1] - trim[0]) })}</p></div>
              <Field><FieldLabel className="sr-only">{t("Trim")}</FieldLabel><Slider min={0} max={source.duration} step={0.1} minStepsBetweenThumbs={5} value={trim} thumbLabels={[t("Start"), t("End")]} className="py-3"
                onValueChange={([start, end]) => { const element = video.current; if (element) { element.pause(); element.currentTime = start !== trim[0] ? start : end; } setTrim([start, end]); }} />
                <FieldDescription>{t("Drag the handles to trim. The preview jumps to the handle you move.")}</FieldDescription></Field>
            </div>}
          </div>
          {size && <EditControls size={size} edits={edits} onChange={setEdits} />}
        </div>
        <div className="flex flex-col gap-4 border-t pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={!job || working} onClick={compress}>{output && !stale ? t("Compress again") : t("Compress video")}</Button>
            {working && <Button variant="outline" onClick={() => abort.current?.abort()}><X data-icon="inline-start" /> {t("Cancel")}</Button>}
            {target && <p className="meta tabular-nums">{t('Output {width} × {height}', { width: target.width, height: target.height })}</p>}
          </div>
          {stage && <div aria-live="polite" className="flex flex-col gap-2"><Progress value={stage.progress * 100} aria-label={t("Progress")} /><p className="meta">{stage.engine === 'ffmpeg' ? (stage.step === 'loading' ? t("This browser can’t use WebCodecs for this file. Downloading the compatibility engine (32 MB, once)…") : t('Compressing with ffmpeg.wasm (slower) · {progress}', { progress: `${Math.round(stage.progress * 100)}%` })) : t('Compressing with WebCodecs · {progress}', { progress: `${Math.round(stage.progress * 100)}%` })}</p></div>}
          {error && <Alert variant="destructive"><AlertTitle>{t("Couldn’t compress this video")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        {output && change && <div className="grid gap-8 @3xl:grid-cols-2 @3xl:items-start">
          <div className="flex flex-col gap-4">
            <div aria-live="polite"><h2 className="meta">{t("Compressed video")}</h2><p className="result-value mt-1">{change.after}</p><p className="text-xs text-muted-foreground">{t('From {before} · {change}', { before: change.before, change: change.change })} · {output.engine === 'webcodecs' ? 'WebCodecs' : 'ffmpeg.wasm'}</p></div>
            {stale && <p className="text-sm text-muted-foreground">{t("Settings changed. Compress again to update the result.")}</p>}
            {change.larger && <p className="text-sm text-destructive">{t("The result is larger than the original. Try more compression or a smaller size.")}</p>}
            <Button className="self-start" onClick={() => downloadBlob(output.url, renamed(source.file.name, output.format))}><Download data-icon="inline-start" /> {t("Download")}</Button>
            <Insights items={[{ label: t("Before"), value: change.before }, { label: t("After"), value: change.after }, { label: t("Change"), value: change.change }]} />
          </div>
          <div className="crop-stage"><video src={output.url} controls playsInline width={output.width} height={output.height} aria-label={t("Compressed video")} /></div>
        </div>}
      </div>}
    </section>
  </div>;
}

export default function VideoCompressor({ locale = 'en' }: { locale?: Locale }) {
  return <LocaleProvider locale={locale}><VideoCompressorContent /></LocaleProvider>;
}
