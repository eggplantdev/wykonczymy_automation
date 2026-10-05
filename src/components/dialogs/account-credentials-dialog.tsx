'use client'

import { KeyRound } from 'lucide-react'
import { FormDialog } from '@/components/ui/form-dialog'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { AccountCredentialsForm } from '@/components/forms/account-credentials-form/account-credentials-form'
import { useTranslation } from '@/hooks/use-translation'

export function AccountCredentialsDialog({ email }: { email: string }) {
  const formId = 'account-credentials'
  const { t } = useTranslation('account')

  return (
    <FormDialog
      formId={formId}
      showKeepOpen={false}
      trigger={<RowActionButton icon={KeyRound} label={t('title')} showLabel className="w-fit" />}
      title={t('title')}
      description={t('description')}
    >
      {(onSubmitSuccess) => (
        <AccountCredentialsForm formId={formId} email={email} onSubmitSuccess={onSubmitSuccess} />
      )}
    </FormDialog>
  )
}
