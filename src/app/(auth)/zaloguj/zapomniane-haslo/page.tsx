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
