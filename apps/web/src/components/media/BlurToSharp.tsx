import { ArrowRight, Image } from 'lucide-react';

/** What the upscaler does, without words: a blurry image, an arrow, the same image sharp. */
export function BlurToSharp({ className = '' }: { className?: string }) {
  const tile = 'flex size-14 items-center justify-center rounded-xl bg-secondary';
  return <div aria-hidden="true" className={`flex items-center gap-3 ${className}`}>
    <span className={tile}><Image size={28} strokeWidth={1.75} className="text-muted-foreground blur-[2px]" /></span>
    <ArrowRight size={18} strokeWidth={1.75} className="text-muted-foreground" />
    <span className={tile}><Image size={28} strokeWidth={1.75} className="text-foreground" /></span>
  </div>;
}
