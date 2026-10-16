import {
  canBeSettled,
  carriesPaymentMethod,
  needsSourceRegister,
  needsTargetRegister,
  needsWorker,
  showsInvestment,
} from '@/lib/constants/transfers'

// It must blank them to EMPTY, never via form.resetField(): a reset re-armed the hidden field with
// the very value it was meant to drop.

const EMPTY_VALUE = {
  sourceRegister: '',
  targetRegister: '',
  worker: '',
  settled: false,
  paymentMethod: '',
} as const

export type ConditionalFieldT = keyof typeof EMPTY_VALUE

const CARRIED_BY: Record<ConditionalFieldT, (type: string) => boolean> = {
  sourceRegister: needsSourceRegister,
  targetRegister: needsTargetRegister,
  worker: needsWorker,
  settled: canBeSettled,
  paymentMethod: carriesPaymentMethod,
}

export function staleFieldsForType(type: string): [ConditionalFieldT, '' | false][] {
  const fields = Object.keys(CARRIED_BY) as ConditionalFieldT[]
  return fields
    .filter((field) => !CARRIED_BY[field](type))
    .map((field) => [field, EMPTY_VALUE[field]])
}

export function investmentForType(
  type: string,
  current: string | undefined,
  fromUrl: string,
): string {
  return showsInvestment(type) ? current || fromUrl : ''
}

export function sourceRegisterForType(
  type: string,
  current: string | undefined,
  fallback: string,
): string {
  return needsSourceRegister(type) ? current || fallback : ''
}
