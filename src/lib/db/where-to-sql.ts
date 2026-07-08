import type { Where } from 'payload'

/** Detects the NO_RESULTS sentinel ({ id: { equals: -1 } }) in a Where clause. */
export const isNoResultsSentinel = (where: Where): boolean => {
  const id = where.id as Record<string, unknown> | undefined
  return id !== undefined && 'equals' in id && id.equals === -1
}

const FIELD_TO_COLUMN: Record<string, string> = {
  type: 'type',
  sourceRegister: 'source_register_id',
  targetRegister: 'target_register_id',
  investment: 'investment_id',
  createdBy: 'created_by_id',
  expenseCategory: 'expense_category_id',
  otherCategory: 'other_category_id',
  worker: 'worker_id',
  paymentMethod: 'payment_method',
  date: 'date',
  cancelled: 'cancelled',
  amount: 'amount',
}

/**
 * Translates a flat Payload Where object to SQL AND clauses.
 * Only handles the operators used by buildTransferFilters():
 *   { field: { equals: value } }
 *   { field: { not_equals: value } }
 *   { field: { in: values[] } }
 *   { field: { not_in: values[] } }
 *   { field: { greater_than_equal: value } }
 *   { field: { less_than_equal: value } }
 *
 * All values come from buildTransferFilters() which validates against known enums
 * and parses numeric IDs. escapeValue provides SQL injection protection as a second layer.
 */
export function buildSqlConditions(where: Where): string {
  const clauses: string[] = []

  for (const [field, condition] of Object.entries(where)) {
    if (field === 'id') continue // skip impossible-condition sentinel

    // Handle OR conditions (e.g. sourceRegister OR targetRegister)
    if (field === 'or' && Array.isArray(condition)) {
      const orParts = condition.map((sub: Where) => buildFieldCondition(sub)).filter(Boolean)
      if (orParts.length > 0) {
        clauses.push(`AND (${orParts.join(' OR ')})`)
      }
      continue
    }

    const part = buildFieldCondition({ [field]: condition })
    if (part) clauses.push(`AND ${part}`)
  }

  return clauses.join('\n      ')
}

/** Builds a single-field condition string (without AND prefix). Only handles the first matched field. */
function buildFieldCondition(where: Where): string | null {
  for (const [field, condition] of Object.entries(where)) {
    const column = FIELD_TO_COLUMN[field]
    if (!column || typeof condition !== 'object' || condition === null) continue

    const cond = condition as Record<string, unknown>
    const parts: string[] = []

    if ('equals' in cond) {
      parts.push(`${column} = ${escapeValue(cond.equals)}`)
    }
    if ('not_equals' in cond) {
      parts.push(`${column} != ${escapeValue(cond.not_equals)}`)
    }
    if ('in' in cond && Array.isArray(cond.in)) {
      const vals = cond.in.map(escapeValue).join(', ')
      parts.push(`${column} IN (${vals})`)
    }
    if ('not_in' in cond && Array.isArray(cond.not_in)) {
      const vals = cond.not_in.map(escapeValue).join(', ')
      parts.push(`${column} NOT IN (${vals})`)
    }
    if ('greater_than_equal' in cond) {
      parts.push(`${column} >= ${escapeValue(cond.greater_than_equal)}`)
    }
    if ('less_than_equal' in cond) {
      parts.push(`${column} <= ${escapeValue(cond.less_than_equal)}`)
    }
    // Prefix match on numeric columns (e.g. amount): cast to text, then LIKE '15%'
    // Callers must pre-validate values — this path uses sql.raw(), not parameterized queries
    if ('like' in cond) {
      parts.push(`${column}::text LIKE ${escapeValue(cond.like)} || '%'`)
    }

    if (parts.length > 0) return parts.join(' AND ')
  }
  return null
}

function escapeValue(val: unknown): string {
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
  return 'NULL'
}
