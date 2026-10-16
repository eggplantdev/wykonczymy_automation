import { z } from 'zod'
import { refineAmount, refineDate } from '@/lib/utils/validation'

export const createInternalTransferSchema = z
  .object({
    description: z.string().optional().default(''),
    amount: z.number().positive('Kwota musi być większa niż 0'),
    date: z.string().min(1, 'Data jest wymagana'),
    sourceRegister: z.number({ error: 'Kasa źródłowa jest wymagana' }),
    targetRegister: z.number({ error: 'Kasa docelowa jest wymagana' }),
  })
  .superRefine((data, ctx) => {
    if (data.targetRegister === data.sourceRegister) {
      ctx.addIssue({
        code: 'custom',
        message: 'Kasa docelowa musi być inna niż kasa źródłowa',
        path: ['targetRegister'],
      })
    }
  })

export const internalTransferFormSchema = z
  .object({
    description: z.string(),
    amount: z.string(),
    date: z.string(),
    sourceRegister: z.string(),
    targetRegister: z.string(),
  })
  .superRefine((data, ctx) => {
    refineAmount(data, ctx)
    refineDate(data, ctx)

    if (!data.sourceRegister) {
      ctx.addIssue({
        code: 'custom',
        message: 'Kasa źródłowa jest wymagana',
        path: ['sourceRegister'],
      })
    }

    if (!data.targetRegister) {
      ctx.addIssue({
        code: 'custom',
        message: 'Kasa docelowa jest wymagana',
        path: ['targetRegister'],
      })
    }

    if (data.targetRegister && data.sourceRegister && data.targetRegister === data.sourceRegister) {
      ctx.addIssue({
        code: 'custom',
        message: 'Kasa docelowa musi być inna niż kasa źródłowa',
        path: ['targetRegister'],
      })
    }
  })
