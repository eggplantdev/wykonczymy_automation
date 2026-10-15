// The rules live here so the local loader and the production SQL loader can't drift apart.

export const ROUND_BLOCK_SEPARATOR = '\n\n'

const roundPrefix = (round: number) => `Runda ${round} — `

export function appendRoundBlock(existing: string | null, block: string): string {
  return existing?.trim() ? `${existing}${ROUND_BLOCK_SEPARATOR}${block}` : block
}

// The block names its round itself, so a pozycja's history reads without the loader's help.
export function assertRoundDraft(
  rows: readonly { section: string; description: string; qty: number; newInformation?: string }[],
  round: number,
): void {
  if (!Number.isInteger(round) || round < 2)
    throw new Error(`ROUND must be 2 or more, got ${round}`)
  const bad = rows.filter(
    (row) => !Number.isFinite(row.qty) || !row.newInformation?.startsWith(roundPrefix(round)),
  )
  if (bad.length) {
    throw new Error(
      `every round-${round} draft row needs a qty and newInformation starting „${roundPrefix(round)}”: ` +
        bad.map((row) => `${row.section} | ${row.description}`).join('; '),
    )
  }
}

// A re-run would append the same block twice; the loaders refuse a round already on any pozycja.
export function hasRoundBlock(text: string | null | undefined, round: number): boolean {
  return (text ?? '').split('\n').some((line) => line.startsWith(roundPrefix(round)))
}
