# Forgot Password — Design

## Overview

Add forgot/reset password flow to the custom frontend login page. Uses Payload's built-in `forgotPassword` and `resetPassword` operations with a custom Polish HTML email template matching the app's monochrome branding.

## Pages

### 1. `/zaloguj/zapomniane-haslo` — Forgot Password

- Email input form
- On submit: calls `forgotPasswordAction(email)` server action
- Always shows success message regardless of whether email exists (security)
- Link back to login

### 2. `/zaloguj/reset-hasla` — Reset Password

- Reads `?token=xxx` from URL search params
- Form: new password + confirm password (Zod validation — min length, match)
- On submit: calls `resetPasswordAction(token, password)` server action
- Success → redirect to `/zaloguj`
- Invalid/expired token → error message

### 3. Login Page Update

- Add "Nie pamiętasz hasła?" link below the login button

## Server Actions (`src/lib/actions/auth.ts`)

### `forgotPasswordAction(email: string)`

- Calls `payload.forgotPassword({ collection: 'users', data: { email } })`
- Returns `ActionResultT` — always success (don't leak whether email exists)
- Payload generates token, calls `generateEmailHTML`, sends email

### `resetPasswordAction(data: { token: string; password: string })`

- Calls `payload.resetPassword({ collection: 'users', data: { token, password } })`
- Returns `ActionResultT` with success/error

## Payload Config Change (`src/collections/users.ts`)

Add to `auth` config:

```ts
auth: {
  tokenExpiration: 86400,
  forgotPassword: {
    generateEmailHTML: ({ token, user }) => { /* custom HTML */ },
    generateEmailSubject: () => 'Resetowanie hasła — Wykonczymy',
  },
}
```

## Email Template

- Inline CSS, HTML email
- Monochrome theme matching app (`#1a1a1a` primary, `#fafafa` background)
- Polish text: greeting, explanation, CTA button, expiration note
- Reset link: `${FRONTEND_URL}/zaloguj/reset-hasla?token=${token}`
- Uses `NEXT_PUBLIC_FRONTEND_URL` env var for the base URL

## Data Flow

```
/zaloguj → "Nie pamiętasz hasła?" → /zaloguj/zapomniane-haslo
  → submit email → forgotPasswordAction → payload.forgotPassword()
  → Payload: generate token → generateEmailHTML() → send email
  → User clicks email link → /zaloguj/reset-hasla?token=xxx
  → submit password → resetPasswordAction → payload.resetPassword()
  → redirect → /zaloguj
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/collections/users.ts` | Add `forgotPassword` config to `auth` |
| `src/lib/actions/auth.ts` | Add `forgotPasswordAction`, `resetPasswordAction` |
| `src/app/(auth)/zaloguj/zapomniane-haslo/page.tsx` | Forgot password page |
| `src/app/(auth)/zaloguj/zapomniane-haslo/forgot-password-form.tsx` | Client form component |
| `src/app/(auth)/zaloguj/reset-hasla/page.tsx` | Reset password page |
| `src/app/(auth)/zaloguj/reset-hasla/reset-password-form.tsx` | Client form component |
| `src/app/(auth)/zaloguj/login-form.tsx` | Add forgot password link |
| `src/lib/email/forgot-password-template.ts` | HTML email template function |
