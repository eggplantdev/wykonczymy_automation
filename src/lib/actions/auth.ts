'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
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

    return { success: true }
  } catch {
    return { success: false, error: 'Nieprawidłowy email lub hasło' }
  }
}

export async function logoutAction(): Promise<never> {
  await logout({ config })
  const cookieStore = await cookies()
  cookieStore.delete('payload-token')
  redirect('/zaloguj')
}

export async function forgotPasswordAction(data: { email: string }): Promise<LoginResultT> {
  try {
    const payload = await getPayload({ config })
    await payload.forgotPassword({
      collection: 'users',
      data: { email: data.email },
    })
    return { success: true }
  } catch {
    // Always return success to avoid leaking whether email exists
    return { success: true }
  }
}

export async function resetPasswordAction(data: {
  token: string
  password: string
}): Promise<LoginResultT> {
  try {
    const payload = await getPayload({ config })
    await payload.resetPassword({
      collection: 'users',
      data: { token: data.token, password: data.password },
      overrideAccess: true,
    })
    return { success: true }
  } catch {
    return { success: false, error: 'Link wygasł lub jest nieprawidłowy. Spróbuj ponownie.' }
  }
}
