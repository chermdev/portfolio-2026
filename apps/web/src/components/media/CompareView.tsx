import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from '@portfolio/i18n/react';
import { ChevronsLeftRight } from 'lucide-react';

type View = { s: number; tx: number; ty: number };
const reset: View = { s: 1, tx: 0, ty: 0 };
const MAX_ZOOM = 16;

/**
 * Before/after slider with pinch zoom. Both images share one transform, and the split stays in screen space,
 * so the line doesn't move while you zoom. Trackpad pinch arrives as ctrl+wheel (Safari: gesture events),
 * two-finger scroll pans while zoomed, touch screens pinch with two fingers, double-click resets.
 */
export function CompareView({ before, after, width, height, label }: { before: string; after: string | null; width: number; height: number; label: string }) {
  const { t } = useTranslation();
  const stage = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(50);
  const [view, setView] = useState<View>(reset);
  const latest = useRef(view);
  latest.current = view;

  // Keep the image covering the frame: no zooming out past 100%, no panning past an edge.
  const clamp = (next: View): View => {
    const box = stage.current!.getBoundingClientRect(), s = Math.min(Math.max(next.s, 1), MAX_ZOOM);
    return { s, tx: Math.min(0, Math.max(box.width * (1 - s), next.tx)), ty: Math.min(0, Math.max(box.height * (1 - s), next.ty)) };
  };
  const zoomAt = (from: View, clientX: number, clientY: number, factor: number): View => {
    const box = stage.current!.getBoundingClientRect(), x = clientX - box.left, y = clientY - box.top;
    const s = Math.min(Math.max(from.s * factor, 1), MAX_ZOOM), k = s / from.s;
    return clamp({ s, tx: x - (x - from.tx) * k, ty: y - (y - from.ty) * k });
  };

  useEffect(() => setView(reset), [before, width, height]);
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
    const resize = () => setView(current => clamp(current));
    const listeners: [string, EventListener, AddEventListenerOptions?][] = [
      ['wheel', wheel as EventListener, { passive: false }], ['gesturestart', gestureBegin], ['gesturechange', gesture],
      ['pointerdown', down as EventListener], ['pointermove', move as EventListener], ['pointerup', up as EventListener], ['pointercancel', up as EventListener],
    ];
    for (const [type, listener, options] of listeners) element.addEventListener(type, listener, options);
    addEventListener('resize', resize);
    return () => { for (const [type, listener] of listeners) element.removeEventListener(type, listener); removeEventListener('resize', resize); };
  }, []);

  const transform: CSSProperties = { transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})` };
  // Past 1:1 on the result, show real pixels instead of a blur.
  const box = stage.current?.getBoundingClientRect().width ?? 0;
  const image = `absolute inset-0 size-full ${box * view.s >= width ? '[image-rendering:pixelated]' : ''}`;
  const tag = 'pointer-events-none absolute top-3 rounded-md bg-foreground/70 px-2 py-1 text-xs text-background';
  return <div className="flex flex-col gap-2">
    <div ref={stage} onDoubleClick={() => setView(reset)} className="crop-stage relative mx-auto select-none" style={{ aspectRatio: `${width} / ${height}`, width: `min(100%, calc(min(60vh, 40rem) * ${width / height}))`, touchAction: view.s > 1 ? 'none' : 'pan-y' }}>
      <div className="absolute inset-0 origin-top-left" style={transform}><img src={before} alt={after ? t('Original: {name}', { name: label }) : label} className={image} draggable={false} /></div>
      {after && <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
        <div className="absolute inset-0 origin-top-left" style={transform}><img src={after} alt={t('Enhanced: {name}', { name: label })} className={image} draggable={false} /></div>
      </div>}
      {after ? <>
        <input type="range" min={0} max={100} step={0.1} value={split} onChange={event => setSplit(Number(event.target.value))} aria-label={t("Compare original and enhanced")} className="peer absolute inset-0 m-0 size-full cursor-ew-resize opacity-0" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-background shadow-sm ring-1 ring-foreground/30 peer-focus-visible:*:ring-2" style={{ left: `${split}%` }}>
          <span className="absolute top-1/2 left-1/2 flex size-9 -translate-1/2 items-center justify-center rounded-full bg-background text-foreground shadow-md ring-ring"><ChevronsLeftRight size={18} strokeWidth={1.75} /></span>
        </div>
        <span className={`${tag} left-3`}>{t("Before")}</span><span className={`${tag} right-3`}>{t("After")}</span>
      </> : <span className={`${tag} left-3`}>{t("Original")}</span>}
      {view.s > 1 && <span className={`${tag} top-auto bottom-3 left-3 tabular-nums`}>{Math.round(view.s * 100)}%</span>}
    </div>
    {after && <p className="meta text-center">{t("Drag to compare · pinch or ctrl + scroll to zoom · double-click to reset")}</p>}
  </div>;
}
