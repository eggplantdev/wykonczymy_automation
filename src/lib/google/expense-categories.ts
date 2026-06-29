import type { Payload } from 'payload'

// Expense-category names that drive the per-category summary columns / row coloring
// on the expense-shaped sheet tabs (wydatki inwestycyjne + rozliczone R+M). Shared by
// every setup/reset/link/ensure path so they all seed the tabs with the same, current
// type set — kept out of any 'use server' module so it isn't exposed as an action.
export async function getExpenseTypeNames(payload: Payload): Promise<string[]> {
  const cats = await payload.find({
    collection: 'expense-categories',
    limit: 100,
    overrideAccess: true,
  })
  return cats.docs.map((c) => (c as { name?: string }).name).filter((n): n is string => !!n)
}
