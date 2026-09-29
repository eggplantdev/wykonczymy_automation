import { describe, it, expect } from 'vitest'
import {
  guardTemplateStatus,
  TEMPLATE_STATUS_CHANGE_MESSAGE,
} from '@/hooks/investments/guard-template-status'

type ArgsT = Parameters<typeof guardTemplateStatus>[0]

function hookArgs(
  data: Record<string, unknown>,
  previousStatus: string,
  operation: 'create' | 'update' = 'update',
): ArgsT {
  return {
    data,
    req: { user: { id: 1, role: 'OWNER' } },
    originalDoc: operation === 'update' ? { id: 1, status: previousStatus } : undefined,
    operation,
    collection: undefined,
    context: {},
  } as unknown as ArgsT
}

describe('guardTemplateStatus', () => {
  it.each(['active', 'completed', 'planowana'])('refuses turning a %s investment into a szablon', (from) => {
    expect(() => guardTemplateStatus(hookArgs({ status: 'szablon' }, from))).toThrow(
      TEMPLATE_STATUS_CHANGE_MESSAGE,
    )
  })

  it.each(['active', 'completed', 'planowana'])('refuses turning a szablon into %s', (to) => {
    expect(() => guardTemplateStatus(hookArgs({ status: to }, 'szablon'))).toThrow(
      TEMPLATE_STATUS_CHANGE_MESSAGE,
    )
  })

  it('lets a szablon update that never names the status through', () => {
    expect(() => guardTemplateStatus(hookArgs({ name: 'Łazienka' }, 'szablon'))).not.toThrow()
  })

  it('lets a szablon re-save its own status', () => {
    expect(() => guardTemplateStatus(hookArgs({ status: 'szablon' }, 'szablon'))).not.toThrow()
  })

  it('lets an ordinary status change through', () => {
    expect(() => guardTemplateStatus(hookArgs({ status: 'completed' }, 'active'))).not.toThrow()
  })

  it('lets a create with status szablon through', () => {
    expect(() =>
      guardTemplateStatus(hookArgs({ status: 'szablon' }, '', 'create')),
    ).not.toThrow()
  })
})
