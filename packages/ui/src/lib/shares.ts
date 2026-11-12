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

/** Splits `count` cells by value; a non-zero part gets at least one cell. */
export function cellCounts(values: number[], count: number) {
  const counts = visibleShares(values, 1 / count).map(share => Math.round(share * count))
  const largest = counts.indexOf(Math.max(...counts))
  counts[largest] += count - counts.reduce((sum, cells) => sum + cells, 0)
  return counts
}
