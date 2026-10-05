import type { Where } from 'payload'

/** Detects the NO_RESULTS sentinel ({ id: { equals: -1 } }) in a Where clause. */
export const isNoResultsSentinel = (where: Where): boolean => {
  const id = where.id as Record<string, unknown> | undefined
  return id !== undefined && 'equals' in id && id.equals === -1
}

const FIELD_TO_COLUMN: Record<string, string> = {
  id: 'id',
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
 *
 * Anything this module hasn't been taught — field, operator or value type — throws rather than
 * being skipped (EX-574): every Where reaching here is built in-repo, so the sets are closed and a
 * throw can only mean a caller grew something new. A silent skip turns that into a filter that
 * quietly stops narrowing, which is how the sum tile came to disagree with the list below it.
 *
 * All values come from buildTransferFilters() which validates against known enums
 * and parses numeric IDs. escapeValue provides SQL injection protection as a second layer.
 */
export function buildSqlConditions(where: Where): string {
  return Object.entries(where)
    .map(([field, condition]) => `AND ${renderField(field, condition)}`)
    .join('\n      ')
}

const OPERATORS: Record<string, (column: string, value: unknown) => string> = {
  equals: (column, value) => `${column} = ${escapeValue(value)}`,
  not_equals: (column, value) => `${column} != ${escapeValue(value)}`,
  in: (column, value) => `${column} IN (${renderList('in', value)})`,
  not_in: (column, value) => `${column} NOT IN (${renderList('not_in', value)})`,
  greater_than: (column, value) => `${column} > ${escapeValue(value)}`,
  greater_than_equal: (column, value) => `${column} >= ${escapeValue(value)}`,
  less_than: (column, value) => `${column} < ${escapeValue(value)}`,
  less_than_equal: (column, value) => `${column} <= ${escapeValue(value)}`,
  // Prefix match on numeric columns (e.g. amount): cast to text, then LIKE '15%'
  // Callers must pre-validate values — this path uses sql.raw(), not parameterized queries
  like: (column, value) => `${column}::text LIKE ${escapeValue(value)} || '%'`,
}

/** One field's operators, rendered as a single self-contained condition (no `AND` prefix). */
function renderField(field: string, condition: unknown): string {
  if (field === 'or' || field === 'and') {
    if (!Array.isArray(condition) || condition.length === 0) {
      throw new Error(`where-to-sql: "${field}" expects a non-empty array`)
    }
    const branches = (condition as Where[]).map(renderConjunction)
    return `(${branches.join(field === 'or' ? ' OR ' : ' AND ')})`
  }

  const column = FIELD_TO_COLUMN[field]
  if (!column) throw new Error(`where-to-sql: unmapped field "${field}"`)
  if (typeof condition !== 'object' || condition === null) {
    throw new Error(`where-to-sql: "${field}" expects an operator object`)
  }

  const parts = Object.entries(condition as Record<string, unknown>).map(([operator, value]) => {
    // hasOwn, not a bare lookup: `{ amount: { isPrototypeOf: 5 } }` would otherwise resolve up
    // the prototype chain to a callable and render `AND false` instead of throwing.
    if (!Object.hasOwn(OPERATORS, operator)) {
      throw new Error(`where-to-sql: unsupported operator "${operator}" on "${field}"`)
    }
    return OPERATORS[operator](column, value)
  })

  if (parts.length === 0) throw new Error(`where-to-sql: "${field}" carries no operator`)
  // Parenthesised so a multi-operator field (an amount range) keeps its meaning when spliced
  // into an OR list, rather than relying on AND binding tighter.
  return parts.length === 1 ? parts[0] : `(${parts.join(' AND ')})`
}

/** One `or` / `and` branch: its fields ANDed, like a top-level Where. */
function renderConjunction(where: Where): string {
  const parts = Object.entries(where).map(([field, condition]) => renderField(field, condition))
  // An empty branch would render `()`, a syntax error at best — and inside an `or`, `( OR x)`.
  if (parts.length === 0) throw new Error('where-to-sql: an "or" / "and" branch carries no field')
  return parts.join(' AND ')
}

function renderList(operator: string, value: unknown): string {
  if (!Array.isArray(value)) {
    throw new Error(`where-to-sql: "${operator}" expects an array, got ${typeof value}`)
  }
  return value.map(escapeValue).join(', ')
}

function escapeValue(val: unknown): string {
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
  // Never degrade to the NULL keyword: `col != NULL` is NULL for every row, so the filter would
  // silently match nothing instead of failing (EX-574).
  throw new Error(`where-to-sql: unsupported value type "${typeof val}"`)
}
