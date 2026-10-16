export const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * pl-PL groups thousands with a
 * non-breaking space and Intl's PLN uses a narrow one, and the DOM query normalizes only some of
 * them.
 */
export const bare = (text: string) => text.replace(/[\s\u00a0\u202f]/g, '')
