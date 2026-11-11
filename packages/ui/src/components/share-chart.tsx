import { cn } from "@portfolio/ui/lib/utils"

/** One labeled part of a whole. `value` sets the proportion; it is never printed. */
export type SharePart = { label: string; value: number; color: string }

/** Real proportions, except that a non-zero part never drops below `min`, so a thin slice stays visible. */
export function visibleShares(values: number[], min = 0.08) {
  const total = values.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return values.map(() => 1 / values.length)
  const raw = values.map(value => value / total)
  const small = raw.map(share => share > 0 && share < min)
  const lifted = small.filter(Boolean).length * min
  const rest = raw.reduce((sum, share, index) => (small[index] ? sum : sum + share), 0)
  return raw.map((share, index) => (small[index] ? min : (share / rest) * (1 - lifted)))
}

function ShareLegend({ parts }: { parts: Omit<SharePart, "value">[] }) {
  return <ul className="share-legend">{parts.map(part => <li key={part.label} className="flex items-center gap-2"><span className="size-2 shrink-0 rounded-full" style={{ background: part.color }} />{part.label}</li>)}</ul>
}

/** Illustrates what a whole splits into, without numbers: a donut plus a legend. */
export function ShareDonut({ parts, className }: { parts: SharePart[]; className?: string }) {
  const shares = visibleShares(parts.map(part => part.value))
  const gap = parts.length > 1 ? 1.5 : 0
  let start = 0
  return <div className={cn("share-chart", className)}>
    {/* A circle with r = 100 / 2π has a circumference of 100, so dash lengths are percentages. */}
    <svg viewBox="0 0 42 42" className="share-graphic" aria-hidden="true"><g transform="rotate(-90 21 21)">{parts.map((part, index) => {
      const length = Math.max(0, shares[index] * 100 - gap)
      const circle = <circle key={part.label} cx="21" cy="21" r="15.915" fill="none" stroke={part.color} strokeWidth="7" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-start} />
      start += shares[index] * 100
      return circle
    })}</g></svg>
    <ShareLegend parts={parts} />
  </div>
}

/** Illustrates growth over time, without numbers: stacked bars, one value per part in each step. */
export function ShareBars({ parts, steps, className }: { parts: Omit<SharePart, "value">[]; steps: number[][]; className?: string }) {
  const max = Math.max(...steps.map(step => step.reduce((sum, value) => sum + value, 0)), 1)
  const width = 100 / steps.length
  return <div className={cn("share-chart", className)}>
    <svg viewBox="0 0 100 100" className="share-graphic" aria-hidden="true">{steps.map((step, index) => {
      let top = 100
      return <g key={index}>{step.map((value, part) => {
        const height = (value / max) * 100
        top -= height
        return <rect key={part} x={index * width + width * 0.15} y={top} width={width * 0.7} height={Math.max(0, height - 1.5)} rx="2" fill={parts[part].color} />
      })}</g>
    })}</svg>
    <ShareLegend parts={parts} />
  </div>
}
