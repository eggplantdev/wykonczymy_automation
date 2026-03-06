# Forgot Password Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add forgot/reset password flow with custom Polish email template to the frontend login page.

**Architecture:** Payload's built-in `forgotPassword`/`resetPassword` operations handle token generation, email dispatch, and password hashing. We add a custom `generateEmailHTML` to the Users collection config, two new pages under `(auth)/zaloguj/`, and two server actions. The email uses inline CSS matching the app's monochrome theme.

**Tech Stack:** Payload CMS auth operations, nodemailer (already configured), TanStack Form + Zod, Next.js App Router

---

### Task 1: Email Template

**Files:**
- Create: `src/lib/email/forgot-password-template.ts`

**Step 1: Create the email template function**

```ts
const BRAND_COLOR = '#1a1a1a'
const BG_COLOR = '#fafafa'
const TEXT_COLOR = '#333333'
const MUTED_COLOR = '#666666'

export function forgotPasswordEmailHTML({
  token,
  userName,
}: {
  token: string
  userName?: string
}) {
  const resetUrl = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/zaloguj/reset-hasla?token=${token}`
  const greeting = userName ? `Cześć ${userName},` : 'Cześć,'

  return `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_COLOR};padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background-color:${BRAND_COLOR};padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Wykonczymy</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:${TEXT_COLOR};font-size:16px;line-height:1.5;">${greeting}</p>
          <p style="margin:0 0 24px;color:${TEXT_COLOR};font-size:16px;line-height:1.5;">Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta. Kliknij przycisk poniżej, aby ustawić nowe hasło.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
            <tr><td style="background-color:${BRAND_COLOR};border-radius:6px;">
              <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:12px 32px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">Zresetuj hasło</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:${MUTED_COLOR};font-size:14px;line-height:1.5;">Link wygasa za 1 godzinę.</p>
          <p style="margin:0;color:${MUTED_COLOR};font-size:14px;line-height:1.5;">Jeśli to nie Ty wysłałeś tę prośbę, zignoruj tę wiadomość.</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #eeeeee;">
          <p style="margin:0;color:${MUTED_COLOR};font-size:12px;text-align:center;">© ${new Date().getFullYear()} Wykonczymy</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
```

**Step 2: Commit**

```bash
git add src/lib/email/forgot-password-template.ts
git commit -m "feat: add forgot password email template"
```

---

### Task 2: Payload Users Collection Config

**Files:**
- Modify: `src/collections/users.ts`

**Step 1: Add forgotPassword config to auth**

Import the template at the top:
```ts
import { forgotPasswordEmailHTML } from '@/lib/email/forgot-password-template'
```

Replace the `auth` block:
```ts
auth: {
  tokenExpiration: 86400, // 24 hours until app logs you out
  forgotPassword: {
    generateEmailHTML: ({ token, user }) => {
      return forgotPasswordEmailHTML({
        token: token ?? '',
        userName: (user as { name?: string })?.name,
      })
    },
    generateEmailSubject: () => 'Resetowanie hasła — Wykonczymy',
  },
},
```

**Step 2: Commit**

```bash
git add src/collections/users.ts
git commit -m "feat: configure custom forgot password email in users collection"
```

---

### Task 3: Server Actions

**Files:**
- Modify: `src/lib/actions/auth.ts`

**Step 1: Add forgotPasswordAction and resetPasswordAction**

Add these two functions after the existing `logoutAction`:

```ts
export async function forgotPasswordAction(data: {
  email: string
}): Promise<LoginResultT> {
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
```

Also add the import at the top:
```ts
import { getPayload } from 'payload'
```

**Step 2: Commit**

```bash
git add src/lib/actions/auth.ts
git commit -m "feat: add forgotPassword and resetPassword server actions"
```

---

### Task 4: Forgot Password Page

**Files:**
- Create: `src/app/(auth)/zaloguj/zapomniane-haslo/page.tsx`
- Create: `src/app/(auth)/zaloguj/zapomniane-haslo/forgot-password-form.tsx`

**Step 1: Create the server page**

`page.tsx`:
```tsx
import { ForgotPasswordForm } from './forgot-password-form'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-sm px-4">
      <h1 className="text-foreground mb-2 text-center text-xl font-semibold">Resetowanie hasła</h1>
      <p className="text-muted-foreground mb-6 text-center text-sm">
        Podaj swój adres email, a wyślemy Ci link do zresetowania hasła.
      </p>
      <ForgotPasswordForm />
      <Link
        href="/zaloguj"
        className="text-muted-foreground hover:text-foreground mt-4 block text-center text-sm transition-colors"
      >
        Powrót do logowania
      </Link>
    </div>
  )
}
```

**Step 2: Create the client form**

`forgot-password-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { LoaderCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { forgotPasswordAction } from '@/lib/actions/auth'
import { cn } from '@/lib/cn'

type FormStateT = 'idle' | 'pending' | 'success'

export function ForgotPasswordForm() {
  const [formState, setFormState] = useState<FormStateT>('idle')

  const form = useAppForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      await forgotPasswordAction(value)
      setFormState('success')
    },
  })

  if (formState === 'success') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border p-6">
        <Check className="text-green-600" size={32} />
        <p className="text-foreground text-center text-sm">
          Jeśli konto z tym adresem email istnieje, wysłaliśmy link do zresetowania hasła.
        </p>
      </div>
    )
  }

  const isPending = formState === 'pending'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (isPending) return
        setFormState('pending')
        form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <form.AppField name="email">
        {(field) => (
          <field.Input
            label="Email"
            type="email"
            autoComplete="email"
            showError
            className="text-base"
          />
        )}
      </form.AppField>

      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending ? (
          <>
            <LoaderCircle className="animate-spin" />
            Wysyłanie...
          </>
        ) : (
          'Wyślij link'
        )}
      </Button>
    </form>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/\(auth\)/zaloguj/zapomniane-haslo/
git commit -m "feat: add forgot password page and form"
```

---

### Task 5: Reset Password Page

**Files:**
- Create: `src/app/(auth)/zaloguj/reset-hasla/page.tsx`
- Create: `src/app/(auth)/zaloguj/reset-hasla/reset-password-form.tsx`

**Step 1: Create the server page**

`page.tsx`:
```tsx
import { ResetPasswordForm } from './reset-password-form'
import Link from 'next/link'

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-sm px-4">
      <h1 className="text-foreground mb-6 text-center text-xl font-semibold">Nowe hasło</h1>
      <ResetPasswordForm />
      <Link
        href="/zaloguj"
        className="text-muted-foreground hover:text-foreground mt-4 block text-center text-sm transition-colors"
      >
        Powrót do logowania
      </Link>
    </div>
  )
}
```

**Step 2: Create the client form**

`reset-password-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { LoaderCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { resetPasswordAction } from '@/lib/actions/auth'
import { cn } from '@/lib/cn'

type FormStateT = 'idle' | 'pending' | 'success'

export function ResetPasswordForm() {
  const [error, setError] = useState<string>()
  const [formState, setFormState] = useState<FormStateT>('idle')
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const form = useAppForm({
    defaultValues: { password: '', confirmPassword: '' },
    onSubmit: async ({ value }) => {
      setError(undefined)

      if (value.password !== value.confirmPassword) {
        setFormState('idle')
        setError('Hasła nie są takie same.')
        return
      }

      if (value.password.length < 6) {
        setFormState('idle')
        setError('Hasło musi mieć co najmniej 6 znaków.')
        return
      }

      const response = await resetPasswordAction({
        token: token ?? '',
        password: value.password,
      })

      if (response.success) {
        setFormState('success')
        setTimeout(() => router.push('/zaloguj'), 2000)
      } else {
        setFormState('idle')
        setError(response.error)
      }
    },
  })

  if (!token) {
    return (
      <p className="text-destructive text-center text-sm">
        Brak tokenu resetowania. Sprawdź link z wiadomości email.
      </p>
    )
  }

  if (formState === 'success') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border p-6">
        <Check className="text-green-600" size={32} />
        <p className="text-foreground text-center text-sm">
          Hasło zostało zmienione. Przekierowujemy do logowania...
        </p>
      </div>
    )
  }

  const isPending = formState === 'pending'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (isPending) return
        setFormState('pending')
        form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <form.AppField name="password">
        {(field) => (
          <field.Input
            label="Nowe hasło"
            type="password"
            autoComplete="new-password"
            showError
            className="text-base"
          />
        )}
      </form.AppField>

      <form.AppField name="confirmPassword">
        {(field) => (
          <field.Input
            label="Powtórz hasło"
            type="password"
            autoComplete="new-password"
            showError
            className="text-base"
          />
        )}
      </form.AppField>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending ? (
          <>
            <LoaderCircle className="animate-spin" />
            Zapisywanie...
          </>
        ) : (
          'Zapisz nowe hasło'
        )}
      </Button>
    </form>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/\(auth\)/zaloguj/reset-hasla/
git commit -m "feat: add reset password page and form"
```

---

### Task 6: Add Forgot Password Link to Login Page

**Files:**
- Modify: `src/app/(auth)/zaloguj/login-form.tsx`

**Step 1: Add the link**

Add `import Link from 'next/link'` at the top.

After the closing `</Button>` and before `{isPending && <Loader ...`, add:

```tsx
<Link
  href="/zaloguj/zapomniane-haslo"
  className="text-muted-foreground hover:text-foreground text-center text-sm transition-colors"
>
  Nie pamiętasz hasła?
</Link>
```

**Step 2: Commit**

```bash
git add src/app/\(auth\)/zaloguj/login-form.tsx
git commit -m "feat: add forgot password link to login page"
```

---

### Task 7: Manual Smoke Test

**Step 1: Test forgot password flow**

1. Navigate to `/zaloguj` — verify "Nie pamiętasz hasła?" link appears
2. Click link — verify `/zaloguj/zapomniane-haslo` page loads
3. Submit email — verify success message shows regardless of email
4. Check inbox (or server logs) for email with reset link
5. Click reset link — verify `/zaloguj/reset-hasla?token=xxx` loads
6. Submit mismatched passwords — verify error
7. Submit valid password — verify success and redirect to `/zaloguj`
8. Log in with new password — verify it works

**Step 2: Test edge cases**

1. Visit `/zaloguj/reset-hasla` without token — verify error message
2. Visit `/zaloguj/reset-hasla?token=invalid` and submit — verify error message
3. "Powrót do logowania" links work on both pages
