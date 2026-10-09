// Dice over letter bigrams: cheap, order-insensitive enough for „Gładź gipsowa" against „Gładzie
// gipsowe", and — unlike a prefix test — unbothered by a difference at the front of the name.
// A bigram is two UTF-16 units packed into one integer and the list is kept sorted, so a comparison
// is a merge of two number arrays — /katalog-prac scores ~600 used prace against ~570 wpisy on
// every open, and string keys made that the page's whole render time.
export function bigrams(value: string): Uint32Array {
  const pairs = new Uint32Array(Math.max(value.length - 1, 0))
  for (let i = 0; i < pairs.length; i += 1) {
    pairs[i] = value.charCodeAt(i) * 0x10000 + value.charCodeAt(i + 1)
  }
  return pairs.sort()
}

/**
 * Dice coefficient over two precomputed bigram lists. The caller passes the lists rather than the
 * strings so a one-against-many search folds each candidate once instead of once per comparison.
 */
export function diceSimilarity(left: Uint32Array, right: Uint32Array): number {
  if (left.length === 0 || right.length === 0) return 0
  let shared = 0
  let i = 0
  let j = 0
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      shared += 1
      i += 1
      j += 1
    } else if (left[i] < right[j]) i += 1
    else j += 1
  }
  return (2 * shared) / (left.length + right.length)
}
