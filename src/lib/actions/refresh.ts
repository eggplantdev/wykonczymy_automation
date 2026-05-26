'use server'

import { revalidatePath } from 'next/cache'

export async function refreshDataAction() {
  revalidatePath('/', 'layout')
}
