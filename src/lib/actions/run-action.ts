import type { ZodType, ZodError } from 'zod'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { revalidateCollections, revalidateEntities } from '@/lib/cache/revalidate'
import type { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import type { SessionUserT } from '@/types/auth'
import type { ActionResultT } from '@/types/action'
import { toActionFailure } from '@/lib/actions/action-failure'
import { logError } from '@/lib/utils/log-error'

type ActionCtxT = { payload: Payload; user: SessionUserT }

const DEFAULT_ERROR = 'Wystąpił błąd'

export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : DEFAULT_ERROR
}

const firstZodError = (error: ZodError): string => error.issues[0]?.message ?? DEFAULT_ERROR

export function validateAction<TData>(
  schema: ZodType<TData>,
  data: unknown,
): { success: true; data: TData } | { success: false; error: string } {
  const parsed = schema.safeParse(data)
  if (!parsed.success) return { success: false, error: firstZodError(parsed.error) }
  return { success: true, data: parsed.data }
}

/**
 * Auth + payload + try/catch + perf + revalidation wrapper for actions.
 *
 * `entityTags` is the per-row alternative to the collection list: an action that touches exactly one
 * row can expire that row's readers (`entityTag('investment', id)`) instead of every reader of the
 * collection. Both are applied when both are given.
 */
export async function protectedAction<TData = undefined>(
  label: string,
  handler: (ctx: ActionCtxT) => Promise<ActionResultT<TData>>,
  revalidate?: (keyof typeof CACHE_TAGS)[],
  opts?: { deferRefresh?: boolean; entityTags?: string[] },
): Promise<ActionResultT<TData>> {
  const elapsed = perfStart()
  const started = performance.now()

  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return { success: false, error: session.error } as ActionResultT<TData>
  console.log(`[PERF]   requireAuth ${elapsed()}ms`)

  try {
    const payload = await getPayload({ config })
    console.log(`[PERF]   getPayload ${elapsed()}ms`)

    const result = await handler({ payload, user: session.user })
    console.log(`[PERF]   handler done ${elapsed()}ms`)

    if (result.success) {
      if (revalidate) revalidateCollections(revalidate, opts)
      if (opts?.entityTags) revalidateEntities(opts.entityTags, opts)
      console.log(`[PERF]   revalidate ${elapsed()}ms`)
    }

    console.log(`[PERF] ${label} ${Math.round(performance.now() - started)}ms`)
    return result
  } catch (err) {
    logError(`[ACTION_ERROR] ${label}`, err)
    return toActionFailure(err) as ActionResultT<TData>
  }
}
