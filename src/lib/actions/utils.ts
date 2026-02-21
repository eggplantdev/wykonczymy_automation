import type { ZodType, ZodError } from 'zod'

export type ActionResultT<TData = undefined> = TData extends undefined
  ? { success: true } | { success: false; error: string }
  : { success: true; data: TData } | { success: false; error: string }

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
