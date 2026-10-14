import { cents, documentNumberOf, isWeakMatch, matchExpense, type MatchReasonT } from './match'
import type { DocumentT, DuplicateGroupT, DuplicatePairT } from './types'

const REASON_ORDER: MatchReasonT[] = ['same-number', 'same-receipt', 'same-amount']

// The matcher reads the probe's amount differently from the candidate's (an unread amount lets the
// number count alone), so a pair is matched both ways and the strongest reasons win.
function mergeReasons(...verdicts: (MatchReasonT[] | undefined)[]): MatchReasonT[] {
  const found = new Set(verdicts.flatMap((reasons) => reasons ?? []))
  if (found.size > 1) found.delete('same-amount')
  return REASON_ORDER.filter((reason) => found.has(reason))
}

/**
 * One transakcja and the paragony it was merged from are one purchase; so are a read row and the
 * transakcja booked from it. A transakcja with no recorded read rows was booked before they were
 * tracked, so it could be any paragon of its zgłoszenie.
 */
function areSiblings(a: DocumentT, b: DocumentT): boolean {
  if (a.source === 'transaction' && b.source === 'transaction') return a.id === b.id
  if (a.source === b.source) return false
  const [row, booked] = a.source === 'draft' ? [a, b] : [b, a]
  if (booked.draftId === null || booked.draftId !== row.draftId) return false
  return booked.readRows.length === 0 || booked.readRows.some((read) => row.readRows.includes(read))
}

function bucketBy<D>(documents: D[], keyOf: (doc: D) => string | number | null) {
  const buckets = new Map<string | number, D[]>()
  for (const doc of documents) {
    const key = keyOf(doc)
    if (key === null) continue
    const bucket = buckets.get(key)
    if (bucket) bucket.push(doc)
    else buckets.set(key, [doc])
  }
  return buckets
}

const timestamp = (doc: DocumentT) => (doc.date ? Date.parse(doc.date) || 0 : 0)
const newestFirst = (a: DocumentT, b: DocumentT) =>
  timestamp(b) - timestamp(a) || a.key.localeCompare(b.key)

/**
 * Every match needs equal cents or an equal number, so a probe is compared only with the documents
 * sharing one of its buckets — never all pairs. Each unordered pair comes back once, with at least
 * one probe in it.
 */
export function findDuplicatePairs<D extends DocumentT>(
  documents: D[],
  isProbe: (doc: D) => boolean,
): DuplicatePairT<D>[] {
  const byCents = bucketBy(documents, (doc) => cents(doc.amount))
  const byNumber = bucketBy(documents, documentNumberOf)
  const seen = new Set<string>()
  const pairs: DuplicatePairT<D>[] = []

  for (const probe of documents.filter(isProbe)) {
    const probeCents = cents(probe.amount)
    const probeNumber = documentNumberOf(probe)
    const nearby = [
      ...(probeCents === null ? [] : (byCents.get(probeCents) ?? [])),
      ...(probeNumber === null ? [] : (byNumber.get(probeNumber) ?? [])),
    ]
    for (const other of nearby) {
      if (other.key === probe.key) continue
      const pairKey = [probe.key, other.key].sort().join('\n')
      if (seen.has(pairKey)) continue
      seen.add(pairKey)
      if (areSiblings(probe, other)) continue

      const reasons = mergeReasons(
        matchExpense(probe, other)?.reasons,
        matchExpense(other, probe)?.reasons,
      )
      if (reasons.length > 0) pairs.push({ a: probe, b: other, reasons })
    }
  }
  return pairs
}

function strongComponents<D extends DocumentT>(pairs: DuplicatePairT<D>[]) {
  const parent = new Map<string, string>()
  const root = (key: string): string => {
    const up = parent.get(key) ?? key
    if (up === key) return key
    const top = root(up)
    parent.set(key, top)
    return top
  }
  for (const { a, b } of pairs) parent.set(root(a.key), root(b.key))
  return root
}

function toGroup<D extends DocumentT>(key: string, pairs: DuplicatePairT<D>[]): DuplicateGroupT<D> {
  const members = new Map(pairs.flatMap(({ a, b }) => [a, b]).map((doc) => [doc.key, doc]))
  return {
    key,
    reasons: mergeReasons(...pairs.map((pair) => pair.reasons)),
    members: [...members.values()].sort(newestFirst),
  }
}

const byNewestMember = <D extends DocumentT>(a: DuplicateGroupT<D>, b: DuplicateGroupT<D>) =>
  newestFirst(a.members[0], b.members[0]) || a.key.localeCompare(b.key)

/**
 * Strong groups are the connected documents linked by a number or a paragon. Weak groups hold the
 * same-amount-only pairs, one group per amount — leaving out a pair a strong group already joins.
 */
export function groupDuplicates<D extends DocumentT>(
  pairs: DuplicatePairT<D>[],
): { strong: DuplicateGroupT<D>[]; weak: DuplicateGroupT<D>[] } {
  const strongPairs = pairs.filter((pair) => !isWeakMatch(pair.reasons))
  const root = strongComponents(strongPairs)

  const strong = [...bucketBy(strongPairs, (pair) => root(pair.a.key)).entries()].map(
    ([component, componentPairs]) => toGroup(`strong-${component}`, componentPairs),
  )
  const weakPairs = pairs.filter(
    (pair) => isWeakMatch(pair.reasons) && root(pair.a.key) !== root(pair.b.key),
  )
  const weak = [...bucketBy(weakPairs, (pair) => cents(pair.a.amount)).entries()].map(
    ([amount, amountPairs]) => toGroup(`weak-${amount}`, amountPairs),
  )

  return { strong: strong.sort(byNewestMember), weak: weak.sort(byNewestMember) }
}
