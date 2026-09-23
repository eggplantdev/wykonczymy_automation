import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { ToolPlaneT } from '@/lib/kosztorys/types'

// One home for the subcontractor-price column key namespace, so the builder, its inverse, the
// base-key resolver and the enumerations over it are decided together. Every view assembles BOTH
// planes' price columns, so the plane cannot be inferred from the active view — it travels in the
// column id.

export const PLANE_PRICE_BASE_KEYS = ['priceMode', 'priceCoeff', 'price'] as const

type PlanePriceBaseKeyT = (typeof PLANE_PRICE_BASE_KEYS)[number]

// Disjoint from STAGE_QTY_PREFIX and from every existing column id: a single `_` would make
// `stageValueNet_7` and a plane key the same shape, and diffRow classifies row keys by prefix.
const PLANE_SEPARATOR = '__'

export function planePriceKey(base: PlanePriceBaseKeyT, plane: ToolPlaneT): string {
  return `${base}${PLANE_SEPARATOR}${plane}`
}

// Both halves of a key, or null for anything outside this namespace — including the bare `price` of
// the client's own price column, which is a DIFFERENT figure (the offer price) and must never be
// mistaken for an unqualified subcontractor rate.
export function planePriceKeyParts(
  key: string,
): { base: PlanePriceBaseKeyT; plane: ToolPlaneT } | null {
  const separatorAt = key.indexOf(PLANE_SEPARATOR)
  if (separatorAt === -1) return null
  const base = key.slice(0, separatorAt)
  const plane = key.slice(separatorAt + PLANE_SEPARATOR.length)
  // Both halves are checked against their closed set rather than parsed: an unknown suffix must
  // resolve to null, not fall back to a default plane — a wrong plane reads and WRITES the other
  // crew's rate, which no test asserting a single plane would ever notice.
  if (!PLANE_PRICE_BASE_KEYS.some((candidate) => candidate === base)) return null
  if (!TOOL_PLANES.some((candidate) => candidate === plane)) return null
  return { base: base as PlanePriceBaseKeyT, plane: plane as ToolPlaneT }
}

export function planeOfPriceKey(key: string): ToolPlaneT | null {
  return planePriceKeyParts(key)?.plane ?? null
}

// Enumerations live here rather than at each call site: a caller that needs a SUBSET would otherwise
// hand-assemble the same flatMap and drift the day a third base key lands.
export function planePriceKeysFor(plane: ToolPlaneT): readonly string[] {
  return PLANE_PRICE_BASE_KEYS.map((base) => planePriceKey(base, plane))
}

export const ALL_PLANE_PRICE_KEYS: readonly string[] = TOOL_PLANES.flatMap(planePriceKeysFor)

// The key configuration maps are keyed by — label, tooltip, money axis, layer. Resolving to the base
// is what keeps one concept at one entry per map: an entry per plane would be a chance for the two
// to drift apart, which is the exact failure this change must not have.
//
// NOT for the disclosure allowlist (PREVIEW_VISIBLE_COLUMNS / CLIENT_VIEW_GROUPS /
// sanitizeClientViewVariant): resolving there would let `price__own_tools` inherit `price`'s pass to
// the client preview and leak a subcontractor rate. Those match the full id, always.
export function basePriceKey(key: string): string {
  return planePriceKeyParts(key)?.base ?? key
}
