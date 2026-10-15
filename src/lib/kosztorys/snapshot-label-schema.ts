import { z } from 'zod'

export const snapshotLabelSchema = z.object({
  label: z.string().trim().min(1, 'Podaj nazwę wersji'),
})
