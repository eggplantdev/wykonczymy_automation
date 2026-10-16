export function firstNoteLine(note: string | null | undefined): string | null {
  if (!note) return null
  return (
    note
      .split('\n')
      .find((line) => line.trim().length > 0)
      ?.trim() ?? null
  )
}
