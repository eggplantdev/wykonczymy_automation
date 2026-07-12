import { z } from 'zod'
import {
  EXPENSE_CATEGORY_LABEL,
  needsSourceRegister,
  requiresInvestment,
  needsTargetRegister,
  needsExpenseCategory,
  needsWorker,
} from '@/lib/constants/transfers'

// Shared type-dependent refinement helpers, used by both the single-transfer schemas
// (schemas/transfer.ts) and the bulk-expense schema (expense-form/expense-schema.ts).

type TransferFieldsT = {
  type: string
  sourceRegister?: unknown
  targetRegister?: unknown
  investment?: unknown
  expenseCategory?: unknown
  otherCategory?: unknown
  worker?: unknown
}

type FieldRuleT = {
  invalid: (d: TransferFieldsT) => boolean
  message: string
  path: string
}

const transferFieldRules: FieldRuleT[] = [
  {
    invalid: (d) => needsSourceRegister(d.type) && !d.sourceRegister,
    message: 'Kasa jest wymagana dla tego typu transferu',
    path: 'sourceRegister',
  },
  {
    invalid: (d) => needsTargetRegister(d.type) && !d.targetRegister,
    message: 'Kasa docelowa jest wymagana dla transferu między kasami',
    path: 'targetRegister',
  },
  {
    invalid: (d) =>
      needsTargetRegister(d.type) && !!d.targetRegister && d.targetRegister === d.sourceRegister,
    message: 'Kasa docelowa musi być inna niż kasa źródłowa',
    path: 'targetRegister',
  },
  {
    invalid: (d) => requiresInvestment(d.type) && !d.investment,
    message: 'Inwestycja jest wymagana dla tego typu transferu',
    path: 'investment',
  },
  {
    invalid: (d) => needsWorker(d.type) && !d.worker,
    message: 'Pracownik jest wymagany dla wypłaty',
    path: 'worker',
  },
  {
    invalid: (d) =>
      needsExpenseCategory(d.type, !!d.investment) && !('lineItems' in d) && !d.expenseCategory,
    message: `${EXPENSE_CATEGORY_LABEL} jest wymagany`,
    path: 'expenseCategory',
  },
]

export function validateTransferFields(data: TransferFieldsT, ctx: z.RefinementCtx) {
  for (const rule of transferFieldRules) {
    if (rule.invalid(data)) {
      ctx.addIssue({ code: 'custom', message: rule.message, path: [rule.path] })
    }
  }
}

export function validateLineItemCategories(
  type: string,
  lineItems: { category?: unknown; expenseCategory?: unknown }[],
  ctx: z.RefinementCtx,
  hasInvestment?: boolean,
) {
  lineItems.forEach((item, index) => {
    if (needsExpenseCategory(type, hasInvestment) && !item.expenseCategory) {
      ctx.addIssue({
        code: 'custom',
        message: `${EXPENSE_CATEGORY_LABEL} jest wymagany`,
        path: ['lineItems', index, 'expenseCategory'],
      })
    }
  })
}
