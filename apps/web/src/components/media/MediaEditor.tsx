import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { useTranslation } from '@portfolio/i18n/react';
import { RotateCcw, RotateCw, Upload } from 'lucide-react';
import { Button } from '@portfolio/ui/components/button';
import { Field, FieldLabel, FieldDescription } from '@portfolio/ui/components/field';
import { ToggleGroup, ToggleGroupItem } from '@portfolio/ui/components/toggle-group';
import { centeredRect, fitSize, formatBytes, moveRect, resizeFromCorner, rotatedSize, type Rect, type Rotation, type Size } from './geometry';

export const aspects = { off: null, free: null, '1:1': 1, '4:5': 4 / 5, '16:9': 16 / 9, '9:16': 9 / 16 } as const;
export type Aspect = keyof typeof aspects;
export type Edits = { rotation: Rotation; aspect: Aspect; crop: Rect | null };
export const noEdits: Edits = { rotation: 0, aspect: 'off', crop: null };

/** Draws `source` rotated clockwise into a context whose origin is the top-left of the rotated frame, at `scale`. */
export function drawRotated(context: CanvasRenderingContext2D, source: CanvasImageSource, size: Size, rotation: Rotation, scale = 1) {
  const frame = rotatedSize(size, rotation);
  context.save();
  context.translate(frame.width * scale / 2, frame.height * scale / 2);
  context.rotate(rotation * Math.PI / 180);
  context.drawImage(source, -size.width * scale / 2, -size.height * scale / 2, size.width * scale, size.height * scale);
  context.restore();
}

/** Shows the rotated frame with a draggable crop box. `tick` redraws, for video frames that change under the same source. */
export function CropEditor({ source, size, edits, onCrop, tick = 0, label }: { source: CanvasImageSource | null; size: Size; edits: Edits; onCrop: (crop: Rect) => void; tick?: number; label: string }) {
  const { t } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ mode: 'move'; start: { x: number; y: number }; rect: Rect } | { mode: 'corner'; anchor: { x: number; y: number } } | null>(null);
  const frame = rotatedSize(size, edits.rotation);
  // ponytail: the preview is drawn at most 1600px wide; the export always uses full resolution.
  const preview = fitSize(frame, 1600);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context || !source) return;
    context.clearRect(0, 0, preview.width, preview.height);
    drawRotated(context, source, size, edits.rotation, preview.width / frame.width);
  }, [source, size.width, size.height, edits.rotation, preview.width, preview.height, frame.width, tick]);
  const toFrame = (event: PointerEvent) => {
    const box = canvas.current!.getBoundingClientRect();
    return { x: Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1) * frame.width, y: Math.min(Math.max((event.clientY - box.top) / box.height, 0), 1) * frame.height };
  };
  const ratio = aspects[edits.aspect];
  const crop = edits.crop;
  const start = (event: PointerEvent<HTMLElement>, corner?: [number, number]) => {
    if (!crop) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    // The anchor is the corner opposite the one being dragged.
    drag.current = corner ? { mode: 'corner', anchor: { x: crop.x + (1 - corner[0]) * crop.width, y: crop.y + (1 - corner[1]) * crop.height } } : { mode: 'move', start: toFrame(event), rect: crop };
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current) return;
    const point = toFrame(event);
    onCrop(current.mode === 'move' ? moveRect(current.rect, point.x - current.start.x, point.y - current.start.y, frame) : resizeFromCorner(current.anchor, point, frame, ratio));
  };
  const end = () => { drag.current = null; };
  // Arrows move the box by 1% of the frame; Shift+arrows resize it from the bottom-right corner.
  const key = (event: KeyboardEvent) => {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!crop || !step) return;
    event.preventDefault();
    const dx = step[0] * frame.width / 100, dy = step[1] * frame.height / 100;
    onCrop(event.shiftKey ? resizeFromCorner({ x: crop.x, y: crop.y }, { x: crop.x + crop.width + dx, y: crop.y + crop.height + (ratio ? dx / ratio : dy) }, frame, ratio) : moveRect(crop, dx, dy, frame));
  };
  const percent = (value: number, total: number) => `${value / total * 100}%`;
  return <div className="crop-stage">
    <canvas ref={canvas} width={preview.width} height={preview.height} role="img" aria-label={label} />
    {crop && <div className="crop-box" role="group" tabIndex={0} aria-label={t('Crop area: {width} × {height} px. Arrow keys move it; Shift + arrow keys resize it.', { width: Math.floor(crop.width), height: Math.floor(crop.height) })} onKeyDown={key} onPointerDown={event => start(event)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
      style={{ left: percent(crop.x, frame.width), top: percent(crop.y, frame.height), width: percent(crop.width, frame.width), height: percent(crop.height, frame.height) }}>
      {([[0, 0], [1, 0], [0, 1], [1, 1]] as [number, number][]).map(corner => <span key={corner.join()} aria-hidden="true" className={corner[0] === corner[1] ? 'crop-handle cursor-nwse-resize' : 'crop-handle cursor-nesw-resize'} style={{ left: `${corner[0] * 100}%`, top: `${corner[1] * 100}%` }} onPointerDown={event => start(event, corner)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />)}
    </div>}
  </div>;
}

/** Rotate and crop-ratio controls. Changing either recenters the crop box in the new frame. */
export function EditControls({ size, edits, onChange }: { size: Size; edits: Edits; onChange: (edits: Edits) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const recenter = (rotation: Rotation, aspect: Aspect): Edits => ({ rotation, aspect, crop: aspect === 'off' ? null : centeredRect(rotatedSize(size, rotation), aspects[aspect]) });
  const turn = (by: number) => onChange(recenter(((edits.rotation + by + 360) % 360) as Rotation, edits.aspect));
  return <div className="flex flex-col gap-5">
    <Field><FieldLabel>{t("Rotate")}<span className="meta ml-auto">{edits.rotation}°</span></FieldLabel><div className="flex gap-2">
      <Button type="button" variant="outline" className="h-11 flex-1 sm:h-9" onClick={() => turn(-90)}><RotateCcw aria-hidden="true" /> {t("Left")}</Button>
      <Button type="button" variant="outline" className="h-11 flex-1 sm:h-9" onClick={() => turn(90)}><RotateCw aria-hidden="true" /> {t("Right")}</Button>
    </div></Field>
    <Field><FieldLabel id={id}>{t("Crop")}</FieldLabel><ToggleGroup type="single" variant="outline" className="grid w-full grid-cols-3" aria-labelledby={id} value={edits.aspect} onValueChange={value => { if (value) onChange(recenter(edits.rotation, value as Aspect)); }}>
      {(Object.keys(aspects) as Aspect[]).map(aspect => <ToggleGroupItem key={aspect} value={aspect} className="h-11 sm:h-9">{aspect === 'off' ? t("None") : aspect === 'free' ? t("Free") : aspect}</ToggleGroupItem>)}
    </ToggleGroup>{edits.crop && <FieldDescription>{t("Drag the box or its corners on the preview.")}</FieldDescription>}</Field>
  </div>;
}

/** A click-or-drop target for files. The input stays in the label, so keyboard and screen readers use it as a normal file field. */
export function Dropzone({ accept, multiple = false, onFiles, children }: { accept: string; multiple?: boolean; onFiles: (files: File[]) => void; children: ReactNode }) {
  const [active, setActive] = useState(false);
  return <label className="dropzone" data-active={active} onDragOver={event => { event.preventDefault(); setActive(true); }} onDragLeave={() => setActive(false)} onDrop={event => { event.preventDefault(); setActive(false); onFiles([...event.dataTransfer.files]); }}>
    <Upload aria-hidden="true" size={22} strokeWidth={1.5} />
    {children}
    <input type="file" className="sr-only" accept={accept} multiple={multiple} onChange={event => { onFiles([...(event.target.files ?? [])]); event.target.value = ''; }} />
  </label>;
}

/** Before → after file size, with the change as a percentage. */
export function sizeChange(before: number, after: number, locale: string) {
  const change = after / before - 1;
  return { before: formatBytes(before, locale), after: formatBytes(after, locale), change: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' }).format(change), larger: change > 0 };
}

export const downloadBlob = (url: string, name: string) => { const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); };
export const renamed = (name: string, extension: string) => `${name.replace(/\.[^.]+$/, '')}-compressed.${extension}`;
