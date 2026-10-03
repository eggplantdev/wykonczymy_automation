import { z } from 'zod'

export const requestReviewSchema = z.object({
  email: z.email('Nieprawidłowy adres email'),
})

export type RequestReviewValuesT = z.infer<typeof requestReviewSchema>
