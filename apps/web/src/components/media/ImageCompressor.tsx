import { useEffect, useRef, useState } from 'react';
import { LocaleProvider, useTranslation } from '@portfolio/i18n/react';
import { type Locale } from '@portfolio/i18n';
import { Download, ImageOff, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react';
import { Button } from '@portfolio/ui/components/button';
import { Field, FieldLabel, FieldDescription } from '@portfolio/ui/components/field';
import { Slider } from '@portfolio/ui/components/slider';
import { Spinner } from '@portfolio/ui/components/spinner';
import { ToggleGroup, ToggleGroupItem } from '@portfolio/ui/components/toggle-group';
import { useHydrateCalculator, useImageStore } from '../../stores/calculators';
import { SelectField, Insights } from '../calculators/Fields';
import { CropEditor, Dropzone, EditControls, downloadBlob, drawRotated, noEdits, renamed, sizeChange, type Edits } from './MediaEditor';
import { fitSize, rotatedSize, snapRect } from './geometry';

const formats = [{ type: 'image/webp', label: 'WebP', extension: 'webp' }, { type: 'image/jpeg', label: 'JPEG', extension: 'jpg' }, { type: 'image/png', label: 'PNG', extension: 'png' }, { type: 'image/avif', label: 'AVIF', extension: 'avif' }];
type Settings = { imageFormat: string; imageQuality: string; imageMaxSide: string };
type Result = { key: string; blob: Blob; url: string; width: number; height: number };
type Item = { id: number; file: File; bitmap: ImageBitmap | null; error?: string; edits: Edits; result?: Result };

// Canvas encoders differ by browser (Safari can't write WebP, most can't write AVIF), and an unsupported type silently becomes PNG.
async function canEncode(type: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type));
  return blob?.type === type;
}

/** Rotate → crop → resize → encode, at full resolution. */
async function render(bitmap: ImageBitmap, edits: Edits, settings: Settings) {
  const size = { width: bitmap.width, height: bitmap.height };
  const frame = rotatedSize(size, edits.rotation);
  const crop = edits.crop ? snapRect(edits.crop, frame) : { x: 0, y: 0, ...frame };
  const out = fitSize(crop, Number(settings.imageMaxSide) || null);
  const canvas = document.createElement('canvas');
  canvas.width = out.width; canvas.height = out.height;
  const context = canvas.getContext('2d')!;
  context.imageSmoothingQuality = 'high';
  // JPEG has no transparency; without a fill, transparent pixels turn black.
  if (settings.imageFormat === 'image/jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, out.width, out.height); }
  const scale = out.width / crop.width;
  context.translate(-crop.x * scale, -crop.y * scale);
  drawRotated(context, bitmap, size, edits.rotation, scale);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, settings.imageFormat, Number(settings.imageQuality) / 100));
  if (!blob) throw new Error('Encoding failed');
  return { blob, ...out };
}

function ImageCompressorContent() {
  const { t, locale } = useTranslation();
  const tag = locale === 'es' ? 'es-MX' : 'en-US';
  useHydrateCalculator(useImageStore);
  const { values: settings, set, reset } = useImageStore();
  const [supported, setSupported] = useState<string[]>(['image/jpeg', 'image/png']);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [view, setView] = useState<'edit' | 'result'>('edit');
  const latest = useRef(items);
  latest.current = items;
  const nextId = useRef(1);
  useEffect(() => { void Promise.all(formats.map(async format => await canEncode(format.type) ? format.type : null)).then(types => setSupported(types.filter(Boolean) as string[])); }, []);
  // A saved format this browser can't write falls back to the first one it can.
  const format = supported.includes(settings.imageFormat) ? formats.find(item => item.type === settings.imageFormat)! : formats.find(item => supported.includes(item.type))!;
  const active = { ...settings, imageFormat: format.type };
  const update = (id: number, change: Partial<Item>) => setItems(previous => previous.map(item => item.id === id ? { ...item, ...change } : item));
  const keyFor = (item: Item) => JSON.stringify([item.edits, active]);

  async function add(files: File[]) {
    const images = files.filter(file => file.type.startsWith('image/') || /\.(heic|heif|avif)$/i.test(file.name));
    const added = images.map(file => ({ id: nextId.current++, file, bitmap: null, edits: noEdits }) as Item);
    setItems(previous => [...previous, ...added]);
    if (added[0]) { setSelected(added[0].id); setView('edit'); }
    // createImageBitmap applies EXIF orientation, so phone photos come in upright.
    for (const item of added) createImageBitmap(item.file).then(bitmap => update(item.id, { bitmap }), () => update(item.id, { error: t("This browser can’t read this image.") }));
  }
  function remove(id: number) {
    const item = latest.current.find(entry => entry.id === id);
    if (item?.result) URL.revokeObjectURL(item.result.url);
    item?.bitmap?.close();
    setItems(previous => previous.filter(entry => entry.id !== id));
    if (selected === id) setSelected(latest.current.find(entry => entry.id !== id)?.id ?? null);
  }
  function clear() { latest.current.forEach(item => { if (item.result) URL.revokeObjectURL(item.result.url); item.bitmap?.close(); }); setItems([]); setSelected(null); }
  useEffect(() => () => latest.current.forEach(item => item.result && URL.revokeObjectURL(item.result.url)), []);

  // Re-encode whatever is out of date, one image at a time, shortly after the last change.
  const signature = items.map(item => item.bitmap ? keyFor(item) + item.id : '').join('|');
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      for (const item of latest.current) {
        const key = keyFor(item);
        if (cancelled) return;
        if (!item.bitmap || item.result?.key === key) continue;
        try {
          const output = await render(item.bitmap, item.edits, active);
          if (cancelled) return;
          if (item.result) URL.revokeObjectURL(item.result.url);
          update(item.id, { result: { key, ...output, url: URL.createObjectURL(output.blob) }, error: undefined });
        } catch { update(item.id, { error: t("Couldn’t compress this image.") }); }
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [signature]);

  const current = items.find(item => item.id === selected) ?? items[0];
  const done = items.filter(item => item.result && item.result.key === keyFor(item));
  const pending = items.some(item => !item.error && (!item.result || item.result.key !== keyFor(item)));
  const before = done.reduce((sum, item) => sum + item.file.size, 0), after = done.reduce((sum, item) => sum + item.result!.blob.size, 0);
  const total = done.length ? sizeChange(before, after, tag) : null;
  const download = (item: Item) => item.result && downloadBlob(item.result.url, renamed(item.file.name, format.extension));
  const sizeLabel = (value: string) => value !== '0' ? t('{size} px', { size: value }) : t("Original size");

  return <div className="tool-workspace">
    <aside className="tool-pane-inputs" aria-label={t("Inputs")}>
      <Dropzone accept="image/*,.heic,.heif" multiple onFiles={add}><span className="font-medium text-foreground">{t("Drop images or choose files")}</span><span className="meta">{t("JPEG, PNG, WebP, AVIF, GIF and more")}</span></Dropzone>
      <Field><FieldLabel id="image-format">{t("Convert to")}</FieldLabel><ToggleGroup type="single" variant="outline" className="grid w-full grid-cols-4" aria-labelledby="image-format" value={format.type} onValueChange={value => { if (value) set('imageFormat', value); }}>
        {formats.map(item => <ToggleGroupItem key={item.type} value={item.type} disabled={!supported.includes(item.type)} className="h-11 sm:h-9">{item.label}</ToggleGroupItem>)}
      </ToggleGroup>{supported.length < formats.length && <FieldDescription>{t("Formats this browser can’t write are unavailable.")}</FieldDescription>}</Field>
      <Field data-disabled={format.type === 'image/png' || undefined}><FieldLabel id="image-quality">{t("Quality")}<span className="meta ml-auto tabular-nums">{format.type === 'image/png' ? t("Lossless") : `${settings.imageQuality}%`}</span></FieldLabel>
        <Slider min={10} max={100} step={5} value={[Number(settings.imageQuality)]} onValueChange={([value]) => set('imageQuality', String(value))} disabled={format.type === 'image/png'} thumbLabels={[t("Quality")]} className="py-2" />
        <FieldDescription>{format.type === 'image/png' ? t("PNG is lossless, so quality doesn’t apply. Resize to make it smaller.") : t("Lower means smaller files. 70–85% usually looks the same.")}</FieldDescription></Field>
      <SelectField label={t("Resize: longest side")} value={settings.imageMaxSide} onChange={value => set('imageMaxSide', value)} options={['0', '3840', '2560', '1920', '1280', '800'].map(value => ({ value, label: sizeLabel(value) }))} />
      <div className="mt-auto flex flex-col items-start gap-3 border-t pt-5"><p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={16} /> {t("Images are processed on this device and never uploaded. Settings are saved here.")}</p><Button variant="ghost" size="sm" className="-ml-2.5 h-11 sm:h-8" onClick={reset}><RotateCcw aria-hidden="true" /> {t("Reset settings")}</Button></div>
    </aside>
    <section className="tool-pane-result" aria-label={t("Compressed images")}>
      {!current ? <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-8 text-center text-muted-foreground"><ImageOff aria-hidden="true" size={28} strokeWidth={1.5} /><p className="font-medium text-foreground">{t("No images yet")}</p><p className="max-w-sm text-sm">{t("Add images on the left. Each one is compressed as soon as it loads, and you can rotate or crop it here.")}</p></div> : <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div aria-live="polite"><h2 className="meta">{t('{count} of {total} images compressed', { count: done.length, total: items.length })}</h2><p className="result-value mt-1">{total ? total.after : '—'}</p><p className="text-xs text-muted-foreground">{total ? t('From {before} · {change}', { before: total.before, change: total.change }) : t("Compressing…")}</p></div>
          <div className="flex flex-wrap gap-2"><Button disabled={!done.length || pending} onClick={() => done.forEach((item, index) => setTimeout(() => download(item), index * 250))}><Download data-icon="inline-start" /> {done.length > 1 ? t("Download all") : t("Download")}</Button><Button variant="outline" onClick={clear}><Trash2 data-icon="inline-start" /> {t("Clear")}</Button></div>
        </div>
        <div className="grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_16rem] @3xl:items-start">
          <div className="flex min-w-0 flex-col gap-3">
            <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={value => { if (value) setView(value as typeof view); }} aria-label={t("Preview")} className="self-start"><ToggleGroupItem value="edit" className="h-11 px-4 sm:h-8">{t("Edit")}</ToggleGroupItem><ToggleGroupItem value="result" className="h-11 px-4 sm:h-8" disabled={!current.result}>{t("Result")}</ToggleGroupItem></ToggleGroup>
            {current.error ? <p className="rounded-xl border p-5 text-sm text-destructive">{current.error}</p> : !current.bitmap ? <div className="flex min-h-48 items-center justify-center"><Spinner /></div>
              : view === 'result' && current.result ? <div className="crop-stage"><img src={current.result.url} alt={t('Compressed {name}', { name: current.file.name })} width={current.result.width} height={current.result.height} /></div>
              : <CropEditor source={current.bitmap} size={current.bitmap} edits={current.edits} onCrop={crop => update(current.id, { edits: { ...current.edits, crop } })} label={t('Preview of {name}', { name: current.file.name })} />}
          </div>
          {current.bitmap && <div className="flex flex-col gap-5">
            <EditControls size={current.bitmap} edits={current.edits} onChange={edits => update(current.id, { edits })} />
            {current.result && <dl className="receipt text-sm"><div className="receipt-row"><dt>{t("Original")}</dt><dd>{current.bitmap.width} × {current.bitmap.height}</dd></div><div className="receipt-row"><dt>{t("Output")}</dt><dd>{current.result.width} × {current.result.height}</dd></div></dl>}
          </div>}
        </div>
        {done.length > 0 && total && <Insights items={[{ label: t("Before"), value: total.before }, { label: t("After"), value: total.after }, { label: t("Change"), value: total.change }]} />}
        <ul className="flex flex-col divide-y rounded-xl border" aria-label={t("Images")}>{items.map(item => {
          const change = item.result ? sizeChange(item.file.size, item.result.blob.size, tag) : null;
          return <li key={item.id} className="flex items-center gap-3 p-2 pr-3" aria-current={item.id === current.id || undefined}>
            <button type="button" className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setSelected(item.id); setView('edit'); }}>
              <span className="size-11 shrink-0 overflow-hidden rounded-md bg-muted">{item.result && <img src={item.result.url} alt="" className="size-full object-cover" />}</span>
              <span className="flex min-w-0 flex-col"><span className={item.id === current.id ? 'truncate text-sm font-medium underline underline-offset-4' : 'truncate text-sm font-medium'}>{item.file.name}</span>
                <span className="meta tabular-nums">{item.error ? <span className="text-destructive">{item.error}</span> : change ? <>{change.before} → {change.after} · <span className={change.larger ? 'text-destructive' : undefined}>{change.change}</span></> : t("Compressing…")}</span></span>
            </button>
            <Button size="icon" variant="ghost" className="size-11 sm:size-9" disabled={!item.result} onClick={() => download(item)} aria-label={t('Download {name}', { name: item.file.name })}><Download aria-hidden="true" /></Button>
            <Button size="icon" variant="ghost" className="size-11 sm:size-9" onClick={() => remove(item.id)} aria-label={t('Remove {name}', { name: item.file.name })}><X aria-hidden="true" /></Button>
          </li>; })}</ul>
        {done.some(item => item.result!.blob.size > item.file.size) && <p className="text-xs leading-5 text-muted-foreground">{t("Files marked in red came out larger than the original, which happens with already-optimized images or PNG output. Lower the quality, resize, or keep the original.")}</p>}
      </div>}
    </section>
  </div>;
}

export default function ImageCompressor({ locale = 'en' }: { locale?: Locale }) {
  return <LocaleProvider locale={locale}><ImageCompressorContent /></LocaleProvider>;
}
