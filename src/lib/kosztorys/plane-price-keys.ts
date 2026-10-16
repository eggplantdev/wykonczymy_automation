import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { ToolPlaneT } from '@/lib/kosztorys/types'

export const PLANE_PRICE_BASE_KEYS = ['priceMode', 'priceCoeff', 'price'] as const

type PlanePriceBaseKeyT = (typeof PLANE_PRICE_BASE_KEYS)[number]

// Disjoint from STAGE_QTY_PREFIX and from every existing column id: a single `_` would make
// `stageValueNet_7` and a plane key the same shape, and diffRow classifies row keys by prefix.
const PLANE_SEPARATOR = '__'

export function planePriceKey(base: PlanePriceBaseKeyT, plane: ToolPlaneT): string {
  return `${base}${PLANE_SEPARATOR}${plane}`
}

export function planePriceKeyParts(
  key: string,
): { base: PlanePriceBaseKeyT; plane: ToolPlaneT } | null {
  const separatorAt = key.indexOf(PLANE_SEPARATOR)
  if (separatorAt === -1) return null
  const base = key.slice(0, separatorAt)
  const plane = key.slice(separatorAt + PLANE_SEPARATOR.length)
  // An unknown suffix must resolve to null, not fall back to a default plane — a wrong plane reads
  // and WRITES the other crew's rate.
  if (!PLANE_PRICE_BASE_KEYS.some((candidate) => candidate === base)) return null
  if (!TOOL_PLANES.some((candidate) => candidate === plane)) return null
  return { base: base as PlanePriceBaseKeyT, plane: plane as ToolPlaneT }
}

export function planeOfPriceKey(key: string): ToolPlaneT | null {
  return planePriceKeyParts(key)?.plane ?? null
}

export function planePriceKeysFor(plane: ToolPlaneT): readonly string[] {
  return PLANE_PRICE_BASE_KEYS.map((base) => planePriceKey(base, plane))
}

export const ALL_PLANE_PRICE_KEYS: readonly string[] = TOOL_PLANES.flatMap(planePriceKeysFor)

// NOT for the disclosure allowlist (PREVIEW_VISIBLE_COLUMNS / CLIENT_VIEW_GROUPS /
// sanitizeClientViewSettings): resolving there would let `price__own_tools` inherit `price`'s pass to
// the client preview and leak a subcontractor rate.
export function basePriceKey(key: string): string {
  return planePriceKeyParts(key)?.base ?? key
}
