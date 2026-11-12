import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from '@portfolio/i18n/react';
import { ChevronsLeftRight } from 'lucide-react';

type View = { s: number; tx: number; ty: number };
const reset: View = { s: 1, tx: 0, ty: 0 };
const MAX_ZOOM = 16;

/**
 * Before/after slider with pinch zoom. The frame takes the full width of the pane and the image is fitted inside it,
 * so zooming grows the image into the whole frame instead of staying inside the image's own outline.
 * Both images share one transform, and the split stays in screen space, so the line doesn't move while you zoom. Trackpad pinch arrives as ctrl+wheel (Safari: gesture events),
 * two-finger scroll pans while zoomed, touch screens pinch with two fingers, double-click resets.
 */
export function CompareView({ before, after, width, height, label }: { before: string; after: string | null; width: number; height: number; label: string }) {
  const { t } = useTranslation();
  const stage = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(50);
  const [view, setView] = useState<View>(reset);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const frameRef = useRef(frame);
  frameRef.current = frame;
  // At 100% the image is contained in the frame; `fit` is its size there.
  const fitOf = ({ w, h }: { w: number; h: number }) => { const k = Math.min(w / width, h / height) || 0; return { w: width * k, h: height * k }; };

  // No zooming out past 100%. On each axis, an image smaller than the frame stays centered,
  // and a larger one can't be panned past its edge.
  const clamp = (next: View, box = frameRef.current): View => {
    const fit = fitOf(box), s = Math.min(Math.max(next.s, 1), MAX_ZOOM);
    const axis = (t: number, size: number, room: number) => size <= room ? (room - size) / 2 : Math.min(0, Math.max(room - size, t));
    return { s, tx: axis(next.tx, fit.w * s, box.w), ty: axis(next.ty, fit.h * s, box.h) };
  };
  const latest = useRef(view);
  latest.current = clamp(view, frame);
  const zoomAt = (from: View, clientX: number, clientY: number, factor: number): View => {
    const box = stage.current!.getBoundingClientRect(), x = clientX - box.left, y = clientY - box.top;
    const s = Math.min(Math.max(from.s * factor, 1), MAX_ZOOM), k = s / from.s;
    return clamp({ s, tx: x - (x - from.tx) * k, ty: y - (y - from.ty) * k });
  };

  useEffect(() => setView(reset), [before, width, height]);
  useEffect(() => {
    const element = stage.current!;
    const observer = new ResizeObserver(([entry]) => setFrame({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = stage.current!;
    const wheel = (event: WheelEvent) => {
      const current = latest.current;
      if (!event.ctrlKey && current.s === 1) return; // let the page scroll
      event.preventDefault();
      setView(event.ctrlKey ? zoomAt(current, event.clientX, event.clientY, Math.exp(-event.deltaY * 0.01)) : clamp({ ...current, tx: current.tx - event.deltaX, ty: current.ty - event.deltaY }));
    };
    let gestureStart = 1;
    const gestureBegin = (event: Event) => { event.preventDefault(); gestureStart = latest.current.s; };
    const gesture = (event: Event) => {
      event.preventDefault();
      const { scale, clientX, clientY } = event as Event & { scale: number; clientX: number; clientY: number };
      setView(zoomAt(latest.current, clientX, clientY, gestureStart * scale / latest.current.s));
    };
    // Two touch points pinch and pan; one keeps working the slider.
    const touches = new Map<number, PointerEvent>();
    let pinch: { d: number; x: number; y: number } | null = null;
    const down = (event: PointerEvent) => { if (event.pointerType === 'touch') touches.set(event.pointerId, event); };
    const move = (event: PointerEvent) => {
      if (!touches.has(event.pointerId)) return;
      touches.set(event.pointerId, event);
      if (touches.size !== 2) { pinch = null; return; }
      const [a, b] = [...touches.values()];
      const now = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
      if (pinch) { const from = pinch, panned = { ...latest.current, tx: latest.current.tx + now.x - from.x, ty: latest.current.ty + now.y - from.y }; setView(zoomAt(panned, now.x, now.y, now.d / from.d)); }
      pinch = now;
    };
    const up = (event: PointerEvent) => { touches.delete(event.pointerId); pinch = null; };
    const listeners: [string, EventListener, AddEventListenerOptions?][] = [
      ['wheel', wheel as EventListener, { passive: false }], ['gesturestart', gestureBegin], ['gesturechange', gesture],
      ['pointerdown', down as EventListener], ['pointermove', move as EventListener], ['pointerup', up as EventListener], ['pointercancel', up as EventListener],
    ];
    for (const [type, listener, options] of listeners) element.addEventListener(type, listener, options);
    return () => { for (const [type, listener] of listeners) element.removeEventListener(type, listener); };
  }, []);

  // Recomputed from the frame on every render, so a resize keeps the image centered or in bounds.
  const shown = latest.current, fit = fitOf(frame);
  const transform: CSSProperties = { width: fit.w, height: fit.h, transform: `translate(${shown.tx}px, ${shown.ty}px) scale(${shown.s})` };
  // Past 1:1 on the result, show real pixels instead of a blur.
  const image = `absolute inset-0 size-full ${fit.w * shown.s >= width ? '[image-rendering:pixelated]' : ''}`;
  const tag = 'pointer-events-none absolute top-3 rounded-md bg-foreground/70 px-2 py-1 text-xs text-background';
  return <div className="flex flex-col gap-2">
    <div ref={stage} onDoubleClick={() => setView(reset)} className="relative w-full overflow-hidden rounded-xl bg-secondary select-none" style={{ aspectRatio: `${width} / ${height}`, maxHeight: 'min(60vh, 40rem)', touchAction: shown.s > 1 ? 'none' : 'pan-y' }}>
      <div className="checkerboard absolute top-0 left-0 origin-top-left" style={transform}><img src={before} alt={after ? t('Original: {name}', { name: label }) : label} className={image} draggable={false} /></div>
      {after && <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
        <div className="absolute top-0 left-0 origin-top-left" style={transform}><img src={after} alt={t('Enhanced: {name}', { name: label })} className={image} draggable={false} /></div>
      </div>}
      {after ? <>
        <input type="range" min={0} max={100} step={0.1} value={split} onChange={event => setSplit(Number(event.target.value))} aria-label={t("Compare original and enhanced")} className="peer absolute inset-0 m-0 size-full cursor-ew-resize opacity-0" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-background shadow-sm ring-1 ring-foreground/30 peer-focus-visible:*:ring-2" style={{ left: `${split}%` }}>
          <span className="absolute top-1/2 left-1/2 flex size-9 -translate-1/2 items-center justify-center rounded-full bg-background text-foreground shadow-md ring-ring"><ChevronsLeftRight size={18} strokeWidth={1.75} /></span>
        </div>
        <span className={`${tag} left-3`}>{t("Before")}</span><span className={`${tag} right-3`}>{t("After")}</span>
      </> : <span className={`${tag} left-3`}>{t("Original")}</span>}
      {shown.s > 1 && <span className={`${tag} top-auto bottom-3 left-3 tabular-nums`}>{Math.round(shown.s * 100)}%</span>}
    </div>
    {after && <p className="meta text-center">{t("Drag to compare · pinch or ctrl + scroll to zoom · double-click to reset")}</p>}
  </div>;
}
