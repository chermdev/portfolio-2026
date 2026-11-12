import { useId } from "react"
import { cn } from "@portfolio/ui/lib/utils"
import { visibleShares } from "@portfolio/ui/lib/shares"

export type IcebergPart = { label: string; amount: number; value: string; color: string }
export type IcebergGroup = { title: string; parts: IcebergPart[] }

const width = 200, top = 16, height = 280, water = "color-mix(in oklab, var(--glow-3) 16%, transparent)"
/** Half-width of the berg at a height: a narrow peak above the water, a wide mass that bulges below it, then a point. */
function halfWidth(y: number, waterline: number) {
  if (y <= waterline) return 10 + ((y - top) / Math.max(1, waterline - top)) * 48
  const depth = (y - waterline) / Math.max(1, top + height - waterline)
  return 6 + 84 * (depth < 0.25 ? 0.8 + 0.8 * depth : Math.pow(1 - (depth - 0.25) / 0.75, 0.8))
}

/**
 * Splits a whole into layers: the first group floats above the water, the rest sink below it.
 * Every layer's height is to scale (thin layers keep 4%), so the waterline shows the real split. The groups and amounts are listed beside it.
 */
export function Iceberg({ groups, label, className }: { groups: IcebergGroup[]; label: string; className?: string }) {
  const clip = `berg${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const floating = groups[0].parts.filter(part => part.amount > 0)
  const sunk = groups.slice(1).flatMap(group => group.parts).filter(part => part.amount > 0)
  const heights = visibleShares([...floating, ...sunk].map(part => part.amount), 0.04).map(share => share * height)
  let y = top
  const layers = [...floating, ...sunk].map((part, index) => { const layer = { part, y, height: heights[index] }; y += layer.height; return layer })
  const waterline = top + heights.slice(0, floating.length).reduce((sum, value) => sum + value, 0)
  const steps = Array.from({ length: 15 }, (_, index) => top + (index / 14) * height)
  // Small sideways kinks per step, fixed so the silhouette is the same on every render.
  const kinks = [0, 4, -3, 6, -2, 3, -5, 2, 5, -4, 3, -2, 4, -3, 0]
  const right = steps.map((stepY, index) => `${width / 2 + halfWidth(stepY, waterline) + kinks[index]} ${stepY}`)
  const left = steps.map((stepY, index) => `${width / 2 - halfWidth(stepY, waterline) + kinks[14 - index]} ${stepY}`).reverse()
  const outline = `M${width / 2 - 4} ${top - 6}L${right.join("L")}L${left.join("L")}Z`
  return <div className={cn("iceberg", className)}>
    <svg viewBox={`0 0 ${width} ${top + height + 8}`} className="iceberg-graphic" role="img" aria-label={label}>
      <defs><clipPath id={clip}><path d={outline} /></clipPath></defs>
      <rect x="0" y={waterline} width={width} height={top + height + 8 - waterline} rx="6" fill={water} />
      <g clipPath={`url(#${clip})`}>
        {layers.map(layer => <rect key={layer.part.label} x="0" y={layer.y} width={width} height={layer.height + 0.5} fill={layer.part.color} />)}
        {layers.slice(1).map(layer => <path key={layer.part.label} d={`M0 ${layer.y}H${width}`} stroke="var(--card)" strokeWidth="1.5" />)}
        {/* A lit face on the left gives the low-poly ice its depth. */}
        <path d={`M${width / 2 - 4} ${top - 6}L${width / 2 - 30} ${waterline}L${width / 2 - 10} ${top + height}L0 ${top + height}L0 0Z`} fill="white" fillOpacity="0.14" />
        <rect x="0" y={waterline} width={width} height={top + height - waterline + 8} fill={water} />
      </g>
      <path d={`M0 ${waterline}H${width}`} stroke="var(--glow-3)" strokeWidth="1.5" strokeDasharray="4 3" />
    </svg>
    <div className="iceberg-legend">{groups.map(group => <div key={group.title}>
      <p className="meta">{group.title}</p>
      <dl className="mt-2 flex flex-col gap-1.5">{group.parts.map(part => <div key={part.label} className="flex items-baseline gap-2 text-sm">
        <dt className="flex min-w-0 items-center gap-2 text-muted-foreground"><span className="size-2 shrink-0 rounded-full" style={{ background: part.color }} />{part.label}</dt>
        <dd className="ml-auto font-medium tabular-nums">{part.value}</dd>
      </div>)}</dl>
    </div>)}</div>
  </div>
}
