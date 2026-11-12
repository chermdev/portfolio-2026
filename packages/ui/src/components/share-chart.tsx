import type { ReactNode } from "react"
import { cn } from "@portfolio/ui/lib/utils"
import { visibleShares, cellCounts } from "@portfolio/ui/lib/shares"

/** One labeled part of a whole. `value` sets the proportion; it is never printed. */
export type SharePart = { label: string; value: number; color: string }
type Legend = Omit<SharePart, "value">[]

// Every chart here reads like its legend: the legend lists parts top-down as they appear in the graphic.

function ShareLegend({ parts }: { parts: Legend }) {
  return <ul className="share-legend">{parts.map(part => <li key={part.label} className="flex items-center gap-2"><span className="size-2 shrink-0 rounded-full" style={{ background: part.color }} />{part.label}</li>)}</ul>
}

function Chart({ viewBox, parts, className, children }: { viewBox: string; parts: Legend; className?: string; children: ReactNode }) {
  return <div className={cn("share-chart", className)}><svg viewBox={viewBox} className="share-graphic" aria-hidden="true">{children}</svg><ShareLegend parts={parts} /></div>
}

/** Illustrates growth over time: stacked bars, one value per part in each step. The first part is the base of each bar. */
export function ShareBars({ parts, steps, className }: { parts: Legend; steps: number[][]; className?: string }) {
  const max = Math.max(...steps.map(step => step.reduce((sum, value) => sum + value, 0)), 1)
  const width = 100 / steps.length
  return <Chart viewBox="0 0 100 100" parts={[...parts].reverse()} className={className}>{steps.map((step, index) => {
    let top = 100
    return <g key={index}>{step.map((value, part) => {
      const height = (value / max) * 100
      top -= height
      return <rect key={part} x={index * width + width * 0.15} y={top} width={width * 0.7} height={Math.max(0, height - 1.5)} rx="2" fill={parts[part].color} />
    })}</g>
  })}</Chart>
}

// Silhouettes drawn in cells ("#"); the wheels are drawn over the car's bottom row.
const shapes = {
  house: ["....##....", "...####...", "..######..", ".########.", "##########", ".########.", ".########.", ".########.", ".########."],
  car: ["....######....", "...########...", "##############", "##############", ".############."],
}
/** Illustrates what a purchase is made of: a house or car built from cells, filled from the ground up in part order. */
export function BlockShape({ shape, parts, className }: { shape: keyof typeof shapes; parts: SharePart[]; className?: string }) {
  const rows = shapes[shape], size = 10
  const cells = rows.flatMap((row, y) => [...row].flatMap((cell, x) => (cell === "#" ? [{ x, y }] : []))).reverse()
  const counts = cellCounts(parts.map(part => part.value), cells.length)
  const colors = counts.flatMap((count, part) => Array(count).fill(parts[part].color))
  const height = rows.length * size + (shape === "car" ? 10 : 0)
  return <Chart viewBox={`0 0 ${rows[0].length * size} ${height}`} parts={[...parts].reverse()} className={className}>
    {cells.map((cell, index) => <rect key={index} x={cell.x * size} y={cell.y * size} width={size - 1.5} height={size - 1.5} rx="1.5" fill={colors[index]} />)}
    {shape === "car" && [3, 10.5].map(x => <circle key={x} cx={x * size} cy={rows.length * size - 1} r="8" fill="var(--muted-foreground)" stroke="var(--card)" strokeWidth="3" />)}
  </Chart>
}

// Lines printed on the paper shapes, in the card color so they read on any fill.
const ink = "color-mix(in oklab, var(--card) 55%, transparent)"
const papers = {
  // A banknote: pay, with the withheld tax torn off its end.
  bill: { width: 124, height: 64, axis: "x", draw: (width: number, height: number, color: string) => <>
    <rect width={width} height={height} rx="6" fill={color} />
    <rect x="6" y="6" width={width - 12} height={height - 12} rx="3" fill="none" stroke={ink} strokeWidth="1.5" />
    <circle cx={width / 2} cy={height / 2} r="13" fill="none" stroke={ink} strokeWidth="1.5" />
    <circle cx="20" cy={height / 2} r="4" fill={ink} /><circle cx={width - 20} cy={height / 2} r="4" fill={ink} />
  </> },
  // An invoice: income, with the tax due torn off its bottom.
  receipt: { width: 64, height: 92, axis: "y", draw: (width: number, height: number, color: string) => <>
    <path d={`M0 4Q0 0 4 0H${width - 4}Q${width} 0 ${width} 4V86${Array.from({ length: 13 }, (_, index) => `L${width - (index * width) / 12} ${index % 2 ? height : 86}`).join("")}Z`} fill={color} />
    {[[14, 44], [26, 36], [38, 44], [50, 28], [62, 40]].map(([y, length]) => <path key={y} d={`M10 ${y}h${length}`} stroke={ink} strokeWidth="3" strokeLinecap="round" />)}
  </> },
} as const

/** Illustrates a whole with a cut taken out: a banknote or invoice whose second part is torn off and drops away. Thin parts keep 8%. */
export function TornPaper({ shape, parts, className }: { shape: keyof typeof papers; parts: [SharePart, SharePart]; className?: string }) {
  const { width, height, axis, draw } = papers[shape]
  const length = axis === "x" ? width : shape === "receipt" ? 86 : height
  const at = visibleShares(parts.map(part => part.value))[0] * length, gap = 1.5
  const [kept, torn] = axis === "x"
    ? [{ x: 0, y: 0, width: at - gap, height }, { x: at + gap, y: 0, width: width - at - gap, height }]
    : [{ x: 0, y: 0, width, height: at - gap }, { x: 0, y: at + gap, width, height: height - at - gap }]
  const shift = axis === "x" ? `translate(5 3) rotate(6 ${at} ${height})` : "translate(0 5)"
  // Nested <svg> viewports clip each piece without clipPath ids.
  return <Chart viewBox={`0 0 ${width + (axis === "x" ? 10 : 0)} ${height + (axis === "x" ? 12 : 6)}`} parts={parts} className={className}>
    <svg {...kept} viewBox={`0 0 ${kept.width} ${kept.height}`}>{draw(width, height, parts[0].color)}</svg>
    <g transform={shift}><svg {...torn} viewBox={`${torn.x} ${torn.y} ${torn.width} ${torn.height}`}>{draw(width, height, parts[1].color)}</svg></g>
  </Chart>
}

/**
 * Illustrates a sale: a cash register with bills (the first part) and coins (the second, such as a fee) beside it.
 * Eight pieces split by value; a non-zero part gets at least one.
 */
export function CashRegister({ parts, className }: { parts: [SharePart, SharePart]; className?: string }) {
  const [bills, coins] = cellCounts(parts.map(part => part.value), 8)
  const body = "color-mix(in oklab, var(--muted-foreground) 45%, transparent)"
  return <Chart viewBox="0 0 148 80" parts={parts} className={className}>
    <rect x="16" y="2" width="32" height="15" rx="2.5" fill={body} />
    <rect x="21" y="7" width="22" height="5" rx="1" fill={ink} />
    <rect x="28" y="17" width="8" height="6" fill={body} />
    <path d="M6 23H58L64 60H0Z" fill={body} />
    {[0, 1, 2].flatMap(column => [0, 1].map(row => <rect key={`${column}${row}`} x={14 + column * 13} y={31 + row * 11} width="10" height="7" rx="1.5" fill={ink} />))}
    <rect x="0" y="62" width="64" height="14" rx="2.5" fill={body} />
    <path d="M24 69h16" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
    {Array.from({ length: bills }, (_, index) => <g key={index} transform={`translate(72 ${54 - index * 5})`}>
      <rect width="46" height="22" rx="3" fill={parts[0].color} stroke="var(--card)" strokeWidth="1.5" />
      <circle cx="23" cy="11" r="5" fill="none" stroke={ink} strokeWidth="1.5" />
    </g>)}
    {Array.from({ length: coins }, (_, index) => <g key={index} transform={`translate(135 ${68 - index * 7})`}>
      <circle r="9" fill={parts[1].color} stroke="var(--card)" strokeWidth="1.5" />
      <circle r="5" fill="none" stroke={ink} strokeWidth="1.5" />
    </g>)}
  </Chart>
}
