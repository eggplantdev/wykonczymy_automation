'use server'

import { workerSchema, type WorkerFormDataT } from '@/lib/schemas/worker'
import { validateAction, protectedAction } from './utils'

export async function createWorkerAction(data: WorkerFormDataT) {
  return protectedAction(
    'createWorkerAction',
    async ({ payload }) => {
      const parsed = validateAction(workerSchema, data)
      if (!parsed.success) return parsed

      await payload.create({
        collection: 'users',
        data: {
          ...parsed.data,
          password: crypto.randomUUID(),
        },
      })

      return { success: true }
    },
    ['users'],
  )
}

export async function updateWorkerAction(id: number, data: WorkerFormDataT) {
  return protectedAction(
    'updateWorkerAction',
    async ({ payload }) => {
      const parsed = validateAction(workerSchema, data)
      if (!parsed.success) return parsed

      await payload.update({
        collection: 'users',
        id,
        data: parsed.data,
      })

      return { success: true }
    },
    ['users'],
  )
}
