export type ActionResultT<TData = undefined> = TData extends undefined
  ? { success: true } | { success: false; error: string }
  : { success: true; data: TData } | { success: false; error: string }

const DEFAULT_ERROR = 'Wystąpił błąd'

export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : DEFAULT_ERROR
}
