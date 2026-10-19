import type { validateTransfer } from '@/collections/hooks/transfers/validate'

type ExecuteT = (query: unknown) => Promise<{ rows: Array<Record<string, unknown>> }>

type ChunkT = { queryChunks?: unknown[]; value?: unknown }

export type ValidateTransferArgsOptionsT = {
  operation?: 'create' | 'update'
  originalDoc?: Record<string, unknown>
  user?: { id: number } | null
  execute?: ExecuteT
}

export const activeInvestmentExecute: ExecuteT = async () => ({ rows: [{ status: 'active' }] })

export function lockedInvestmentExecute(lockedId: number): ExecuteT {
  return async (query) => {
    const id = ((query as ChunkT).queryChunks ?? []).find((chunk) => typeof chunk === 'number')
    return { rows: [{ status: id === lockedId ? 'completed' : 'active' }] }
  }
}

export function readQuery(query: unknown): { text: string; params: number[] } {
  const text: string[] = []
  const params: number[] = []
  const walk = (chunk: unknown) => {
    if (typeof chunk === 'number') params.push(chunk)
    else if (typeof chunk === 'object' && chunk !== null) {
      const { queryChunks, value } = chunk as ChunkT
      if (Array.isArray(queryChunks)) queryChunks.forEach(walk)
      else if (Array.isArray(value)) text.push(value.join(''))
    }
  }
  walk(query)
  return { text: text.join(' '), params }
}

export function validateTransferArgs(
  data: Record<string, unknown>,
  {
    operation = 'create',
    originalDoc,
    user = null,
    execute = activeInvestmentExecute,
  }: ValidateTransferArgsOptionsT = {},
) {
  return {
    data,
    operation,
    originalDoc,
    req: { user, payload: { db: { drizzle: { execute } } } },
    collection: undefined,
    context: {},
  } as unknown as Parameters<typeof validateTransfer>[0]
}
