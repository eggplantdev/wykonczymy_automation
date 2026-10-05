'use client'

import { KeyRound } from 'lucide-react'
import { FormDialog } from '@/components/ui/form-dialog'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { AccountCredentialsForm } from '@/components/forms/account-credentials-form/account-credentials-form'

const TITLE = 'Zmień e-mail lub hasło'

export function AccountCredentialsDialog({ email }: { email: string }) {
  const formId = 'account-credentials'

  return (
    <FormDialog
      formId={formId}
      showKeepOpen={false}
      trigger={<RowActionButton icon={KeyRound} label={TITLE} showLabel className="w-fit" />}
      title={TITLE}
      description="Podaj obecne hasło, żeby potwierdzić zmianę."
    >
      {(onSubmitSuccess) => (
        <AccountCredentialsForm formId={formId} email={email} onSubmitSuccess={onSubmitSuccess} />
      )}
    </FormDialog>
  )
}
