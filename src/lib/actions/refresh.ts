'use server'

import { revalidatePath } from 'next/cache'
import type { ActionResultT } from '@/types/action'

export async function refreshDataAction(): Promise<ActionResultT> {
  revalidatePath('/', 'layout')
  return { success: true }
}
