import { SECTION_COLORS } from '@/lib/kosztorys/section-colors'

/**
 * The palette lives in globals.css as `color-mix()` over the chart hues, and the print popup is a
 * document of its own with no stylesheet — so each section colour is resolved here, against the app's
 * own root, rather than duplicated as hex the two files could drift on.
 */
export function resolveSectionFills(): ReadonlyMap<string, string> {
  const probe = document.createElement('div')
  probe.style.display = 'none'
  document.body.append(probe)
  try {
    return new Map(
      SECTION_COLORS.map(({ key, fill }) => {
        probe.style.backgroundColor = fill
        return [key, getComputedStyle(probe).backgroundColor] as const
      }),
    )
  } finally {
    probe.remove()
  }
}
