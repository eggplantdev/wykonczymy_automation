/**
 * Round a PLN figure to the grosz, for comparing two independently-summed money paths.
 *
 * Shared by the parity and golden-master specs on purpose: if they rounded differently,
 * a drift line could appear (or vanish) purely from float noise below a grosz, and the
 * two suites would disagree about whether a figure moved.
 */
export const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Strip every kind of space a money formatter may have put in — pl-PL groups thousands with a
 * non-breaking space and Intl's PLN uses a narrow one, and the DOM query normalizes only some of
 * them. Spaces carry no signal in a money assertion, so they go before the comparison.
 */
export const bare = (text: string) => text.replace(/[\s\u00a0\u202f]/g, '')
