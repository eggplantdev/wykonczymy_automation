/**
 * Run `fn` over `items` with at most `limit` promises in flight at once; results are
 * returned in input order regardless of completion order. A rejecting `fn` propagates
 * (rejects the whole call) — callers that need per-item isolation catch inside `fn`.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0

  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index], index)
    }
  }

  const poolSize = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: poolSize }, worker))
  return results
}
