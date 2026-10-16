// 0 = singular, 1 = paucal (2–4), 2 = genitive plural (5+, and the 12–14 exception).
function pluralForm(count: number): 0 | 1 | 2 {
  if (count === 1) return 0
  const lastTwo = count % 100
  const last = count % 10
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return 1
  return 2
}

export function pluralize(count: number, forms: readonly [string, string, string]): string {
  return forms[pluralForm(count)]
}
