'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { login, logout } from '@payloadcms/next/auth'
import config from '@payload-config'

type LoginResultT = {
  success: boolean
  error?: string
}

export async function loginAction(data: {
  email: string
  password: string
}): Promise<LoginResultT> {
  try {
    await login({
      collection: 'users',
      config,
      email: data.email,
      password: data.password,
    })

    redirect('/')
  } catch (e) {
    if (isRedirectError(e)) throw e
    return { success: false, error: 'Nieprawidłowy email lub hasło' }
  }
}

export async function logoutAction(): Promise<never> {
  await logout({ config })
  const cookieStore = await cookies()
  cookieStore.delete('payload-token')
  redirect('/zaloguj')
}
