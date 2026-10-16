export const UI_SCALES = [100, 90, 80, 70] as const
export type UiScaleT = (typeof UI_SCALES)[number]

export const DEFAULT_UI_SCALE: UiScaleT = 100

export const UI_SCALE_COOKIE = 'ui-scale'

export function parseUiScale(value: string | undefined): UiScaleT {
  return UI_SCALES.find((scale) => String(scale) === value) ?? DEFAULT_UI_SCALE
}
