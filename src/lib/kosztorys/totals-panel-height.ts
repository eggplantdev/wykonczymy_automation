// The panel's height is a fraction of the grid area, so one split reads the same on a laptop and on
// a tall monitor.
export const FULL_PANEL_FRACTION = 1
// A drag released below this folds the panel instead of leaving a strip too thin to hold the view
// toggle.
const CLOSE_BELOW = 0.15
const FULL_SNAP = 0.9

type PanelSnapT = { open: false } | { open: true; fraction: number }

export function snapPanelFraction(fraction: number): PanelSnapT {
  if (fraction < CLOSE_BELOW) return { open: false }
  return { open: true, fraction: fraction >= FULL_SNAP ? FULL_PANEL_FRACTION : fraction }
}

export function clampFraction(fraction: number): number {
  return Math.min(FULL_PANEL_FRACTION, Math.max(0, fraction))
}

// Only a value snapping could have written — anything else would open the panel as a strip nobody
// can grab.
export function isStoredPanelFraction(value: number): boolean {
  return Number.isFinite(value) && value >= CLOSE_BELOW && value <= FULL_PANEL_FRACTION
}

// The grid's height beside the panel is the same figure, so the two meet with no gap or overlap.
function panelTopPx(fraction: number, gridHeight: number): number {
  return gridHeight - Math.round(clampFraction(fraction) * gridHeight)
}

// `0` reads as folded: the panel parks below the grid area instead of keeping a zero-height strip.
export function panelTop(fraction: number, gridHeight: number): number | '100%' {
  return fraction <= 0 ? '100%' : panelTopPx(fraction, gridHeight)
}

// At full height the grid keeps its whole height under the panel: shrinking it to zero would drop
// its scroll position on every toggle.
export function gridHeightBesidePanel(
  gridHeight: number,
  panel: { open: boolean; fraction: number },
): number {
  if (!panel.open || panel.fraction >= FULL_PANEL_FRACTION) return gridHeight
  return panelTopPx(panel.fraction, gridHeight)
}
