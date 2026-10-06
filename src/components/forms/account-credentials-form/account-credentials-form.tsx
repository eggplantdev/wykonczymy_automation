'use client'

import { FieldGroup } from '@/components/ui/field'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { changeOwnCredentialsAction } from '@/lib/actions/account-credentials'
import { useAccountCredentialsFormStore } from '@/stores/form-stores'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { useTranslation } from '@/hooks/use-translation'
import {
  buildAccountCredentialsFormSchema,
  type AccountCredentialsFormValuesT,
  type AccountCredentialsInputT,
} from './account-credentials-schema'

type AccountCredentialsFormPropsT = {
  formId: string
  email: string
  onSubmitSuccess: () => void
}

export function AccountCredentialsForm({
  formId,
  email,
  onSubmitSuccess,
}: AccountCredentialsFormPropsT) {
  const closeDialog = useOptimisticFormStore((s) => s.closeDialog)
  const translator = useTranslation('account')
  const { t } = translator
  const common = useTranslation('common')
  const { form } = useManagedForm<AccountCredentialsFormValuesT, AccountCredentialsInputT>({
    formId,
    useFormStore: useAccountCredentialsFormStore,
    schema: buildAccountCredentialsFormSchema(translator),
    defaultValues: { email, newPassword: '', confirmPassword: '', currentPassword: '' },
    successMessage: t('saved'),
    onSubmitSuccess,
    // A draft lives in sessionStorage — passwords must never land there.
    persistDraft: false,
    toData: (value) => value,
    action: changeOwnCredentialsAction,
  })

  return (
    <FormShell form={form}>
      <FieldGroup>
        <form.AppField name="email">
          {(field) => (
            <field.Input label={t('email')} type="email" autoComplete="email" showError />
          )}
        </form.AppField>
        <form.AppField name="newPassword">
          {(field) => (
            <field.Input
              label={t('newPassword')}
              type="password"
              autoComplete="new-password"
              placeholder={t('newPasswordPlaceholder')}
              showError
            />
          )}
        </form.AppField>
        <form.AppField name="confirmPassword">
          {(field) => (
            <field.Input
              label={t('confirmPassword')}
              type="password"
              autoComplete="new-password"
              showError
            />
          )}
        </form.AppField>
        <form.AppField name="currentPassword">
          {(field) => (
            <field.Input
              label={t('currentPassword')}
              type="password"
              autoComplete="current-password"
              showError
            />
          )}
        </form.AppField>
      </FieldGroup>

      <FormFooter
        label={common.t('save')}
        submittingLabel={common.t('saving')}
        className="mt-6"
        onCancel={closeDialog}
      />
    </FormShell>
  )
}
