'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { login, logout } from '@payloadcms/next/auth'
import config from '@payload-config'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { revalidateEntities } from '@/lib/cache/revalidate'
import { entityTag } from '@/lib/cache/tags'
import { loginRefusalMessage } from '@/lib/constants/worker-lock'

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
  } catch (error) {
    // Payload locks the account after maxLoginAttempts (default 5, lockTime 10 min).
    return { success: false, error: loginRefusalMessage(error) ?? 'Nieprawidłowy email lub hasło' }
  }
}

export async function logoutAction(): Promise<never> {
  const user = await getCurrentUserJwt()
  await logout({ config })
  // The session check caches its answer per `sid`; without this a copy of the token outlives logout.
  if (user) revalidateEntities([entityTag('user', user.id)])
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
