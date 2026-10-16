export function bigrams(value: string): Uint32Array {
  const pairs = new Uint32Array(Math.max(value.length - 1, 0))
  for (let i = 0; i < pairs.length; i += 1) {
    pairs[i] = value.charCodeAt(i) * 0x10000 + value.charCodeAt(i + 1)
  }
  return pairs.sort()
}

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
