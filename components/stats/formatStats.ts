/**
 * Format batting average: ".333" or "---" for 0 at-bats
 */
export function formatAvg(hits: number, atBats: number): string {
  if (atBats === 0) return "---"
  const avg = hits / atBats
  return avg >= 1 ? "1.000" : avg.toFixed(3).slice(1)
}

/**
 * Format on-base percentage
 */
export function formatObp(
  hits: number,
  walks: number,
  hbp: number,
  atBats: number,
  sacFlies: number
): string {
  const denominator = atBats + walks + hbp + sacFlies
  if (denominator === 0) return "---"
  const obp = (hits + walks + hbp) / denominator
  return obp >= 1 ? "1.000" : obp.toFixed(3).slice(1)
}

/**
 * Format slugging percentage
 */
export function formatSlg(totalBases: number, atBats: number): string {
  if (atBats === 0) return "---"
  const slg = totalBases / atBats
  if (slg >= 10) return slg.toFixed(3)
  return slg >= 1 ? slg.toFixed(3) : slg.toFixed(3).slice(1)
}

/**
 * Format OPS (on-base + slugging) from raw values
 */
export function formatOps(
  hits: number,
  walks: number,
  hbp: number,
  atBats: number,
  sacFlies: number,
  totalBases: number
): string {
  const obpDenom = atBats + walks + hbp + sacFlies
  if (obpDenom === 0 && atBats === 0) return "---"
  const obp = obpDenom > 0 ? (hits + walks + hbp) / obpDenom : 0
  const slg = atBats > 0 ? totalBases / atBats : 0
  const ops = obp + slg
  if (ops >= 10) return ops.toFixed(3)
  return ops >= 1 ? ops.toFixed(3) : ops.toFixed(3).slice(1)
}

/**
 * Format ERA: "3.00" or "---" for 0 outs
 */
export function formatEra(earnedRuns: number, outs: number): string {
  if (outs === 0) return "---"
  const era = (earnedRuns * 27) / outs
  return era.toFixed(2)
}

/**
 * Format innings pitched from outs: 19 outs -> "6.1"
 */
export function formatIp(outs: number): string {
  const full = Math.floor(outs / 3)
  const remainder = outs % 3
  return `${full}.${remainder}`
}
