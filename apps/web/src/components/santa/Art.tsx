import { useMemo } from 'react';
// Decorative Secret Santa illustrations. Colors come from the scoped --festive-* tokens; all are aria-hidden.

export function Tree({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 80 100" className={className} aria-hidden="true">
    <rect x="35" y="82" width="10" height="14" rx="2" fill="var(--festive-ink)" />
    <path d="M40 10 L66 48 H52 L72 82 H8 L28 48 H14 Z" fill="var(--festive-green)" />
    <path d="M22 62 Q40 70 60 58" fill="none" stroke="var(--festive-gold)" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M26 40 Q40 46 54 37" fill="none" stroke="var(--festive-gold)" strokeWidth="2.5" strokeLinecap="round" />
    {[[30, 54, 'red'], [50, 50, 'snow'], [40, 72, 'red'], [58, 72, 'gold'], [22, 74, 'snow'], [42, 32, 'red']].map(([x, y, c]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" fill={`var(--festive-${c})`} />)}
    <path d="M40 2 l2.6 5.4 5.9.8-4.3 4.1 1 5.8L40 15.3l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="var(--festive-gold)" />
  </svg>;
}

export function Santa({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
    <path d="M22 44 Q30 8 66 14 Q84 18 86 44 Z" fill="var(--festive-red)" />
    <path d="M66 14 Q88 10 92 30" fill="none" stroke="var(--festive-red)" strokeWidth="9" strokeLinecap="round" />
    <circle cx="92" cy="32" r="7" fill="var(--festive-snow)" />
    <circle cx="50" cy="56" r="24" fill="var(--festive-skin)" />
    <path d="M24 60 Q26 98 50 98 Q74 98 76 60 Q66 72 50 72 Q34 72 24 60 Z" fill="var(--festive-snow)" />
    <path d="M38 70 Q44 64 50 69 Q56 64 62 70 Q56 74 50 71 Q44 74 38 70 Z" fill="var(--festive-snow)" stroke="var(--border)" strokeWidth="0.6" />
    <rect x="18" y="40" width="64" height="12" rx="6" fill="var(--festive-snow)" />
    <circle cx="41" cy="58" r="2.6" fill="var(--festive-ink)" />
    <circle cx="59" cy="58" r="2.6" fill="var(--festive-ink)" />
    <circle cx="50" cy="64" r="4" fill="var(--festive-red)" opacity="0.75" />
    <circle cx="35" cy="65" r="3.5" fill="var(--festive-red)" opacity="0.18" />
    <circle cx="65" cy="65" r="3.5" fill="var(--festive-red)" opacity="0.18" />
  </svg>;
}

export function Snowman({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 80 100" className={className} aria-hidden="true">
    <circle cx="40" cy="76" r="22" fill="var(--festive-snow)" stroke="var(--border)" strokeWidth="1.5" />
    <circle cx="40" cy="40" r="16" fill="var(--festive-snow)" stroke="var(--border)" strokeWidth="1.5" />
    <rect x="27" y="8" width="26" height="18" rx="2" fill="var(--festive-ink)" />
    <rect x="22" y="24" width="36" height="5" rx="2.5" fill="var(--festive-ink)" />
    <rect x="27" y="19" width="26" height="4" fill="var(--festive-red)" />
    <circle cx="34" cy="37" r="2.2" fill="var(--festive-ink)" />
    <circle cx="46" cy="37" r="2.2" fill="var(--festive-ink)" />
    <path d="M40 42 L52 45 L40 46 Z" fill="var(--festive-gold)" />
    <path d="M26 54 Q40 60 54 54 L54 58 Q40 64 26 58 Z" fill="var(--festive-red)" />
    <path d="M48 58 L52 72 L46 72 Z" fill="var(--festive-red)" />
    {[66, 78, 90].map(y => <circle key={y} cx="40" cy={y} r="2.2" fill="var(--festive-ink)" />)}
  </svg>;
}

/** A gift whose lid lifts when `open`. */
export function Gift({ open = false, className = '' }: { open?: boolean; className?: string }) {
  return <svg viewBox="0 0 100 100" className={`${open ? 'gift-open ' : ''}${className}`} aria-hidden="true" overflow="visible">
    <rect x="16" y="44" width="68" height="50" rx="4" fill="var(--festive-red)" />
    <rect x="45" y="44" width="10" height="50" fill="var(--festive-gold)" />
    <g className="gift-lid">
      <rect x="10" y="32" width="80" height="14" rx="3" fill="var(--festive-red)" stroke="color-mix(in oklab, var(--festive-ink) 25%, transparent)" strokeWidth="1" />
      <rect x="45" y="32" width="10" height="14" fill="var(--festive-gold)" />
      <path d="M50 32 C36 14 24 24 34 32 Z M50 32 C64 14 76 24 66 32 Z" fill="var(--festive-gold)" />
    </g>
  </svg>;
}

/** Tree, Santa, and snowman on a line of snow. */
export function Scene({ className = '' }: { className?: string }) {
  return <div className={`festive-scene ${className}`} aria-hidden="true"><Tree className="festive-sway h-24 w-auto" /><Santa className="h-20 w-auto" /><Snowman className="h-20 w-auto" /><Tree className="festive-sway hidden h-16 w-auto sm:block" /></div>;
}

/** Gently falling snow behind the page. Hidden for reduced motion by the stylesheet. */
export function Snowfall({ count = 28 }: { count?: number }) {
  // Positions are random per mount; they only exist on the client, after hydration.
  const flakes = useMemo(() => Array.from({ length: count }, () => ({ left: Math.random() * 100, size: 3 + Math.random() * 5, duration: 9 + Math.random() * 10, delay: -Math.random() * 18, drift: (Math.random() - 0.5) * 6 })), [count]);
  return <div className="snowfall" aria-hidden="true">{flakes.map((flake, i) => <span key={i} style={{ left: `${flake.left}%`, width: flake.size, height: flake.size, opacity: 0.5 + flake.size / 16, animationDuration: `${flake.duration}s`, animationDelay: `${flake.delay}s`, ['--drift' as string]: `${flake.drift}rem` }} />)}</div>;
}

const burstColors = ['var(--festive-red)', 'var(--festive-green)', 'var(--festive-gold)', 'var(--festive-snow)'];
/** Confetti and snow from the center of `from` (or the screen). Skipped for reduced motion. */
export function celebrate(from?: Element | null) {
  if (typeof window === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = from?.getBoundingClientRect();
  const burst = document.createElement('div');
  burst.className = 'festive-burst';
  burst.setAttribute('aria-hidden', 'true');
  burst.style.left = `${box ? box.left + box.width / 2 : innerWidth / 2}px`;
  burst.style.top = `${box ? box.top + box.height / 2 : innerHeight / 2}px`;
  for (let i = 0; i < 44; i++) {
    const particle = document.createElement('span');
    const angle = Math.random() * Math.PI * 2, distance = 70 + Math.random() * 170;
    particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    particle.style.setProperty('--dy', `${Math.sin(angle) * distance + 60}px`);
    particle.style.setProperty('--rot', `${(Math.random() - 0.5) * 720}deg`);
    particle.style.background = burstColors[i % burstColors.length];
    if (i % 3 === 0) particle.style.borderRadius = '9999px';
    particle.style.animationDelay = `${Math.random() * 120}ms`;
    burst.append(particle);
  }
  // The festive tokens are scoped, so the burst lives inside the themed tool.
  (document.querySelector('.festive') ?? document.body).append(burst);
  setTimeout(() => burst.remove(), 1500);
}
