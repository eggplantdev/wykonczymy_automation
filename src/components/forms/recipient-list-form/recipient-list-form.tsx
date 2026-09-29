'use client'

import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { RemoveButton } from '@/components/ui/remove-button'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { useRecipientListFormStore } from '@/stores/form-stores'
import {
  makeRecipientRow,
  recipientListFormSchema,
  type RecipientListFormValuesT,
} from './recipient-list-schema'
import type { ActionResultT } from '@/types/action'

// The array-field surface this form drives (`form.Field name="emails" mode="array"`). Structural
// because TanStack's real FieldApi generic is unnameable; mirrors `line-items-field.tsx`.
type EmailsArrayFieldT = {
  state: { value: RecipientListFormValuesT['emails'] }
  pushValue: (value: RecipientListFormValuesT['emails'][number]) => void
  removeValue: (index: number) => void
}

type RecipientListFormPropsT = {
  formId: string
  emails: string[]
  action: (emails: string[]) => Promise<ActionResultT>
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

export function RecipientListForm({
  formId,
  emails,
  action,
  onSubmitSuccess,
  keepOpen,
}: RecipientListFormPropsT) {
  const { form, reset } = useManagedForm<RecipientListFormValuesT, string[]>({
    formId,
    useFormStore: useRecipientListFormStore,
    schema: recipientListFormSchema,
    defaultValues: { emails: emails.map(makeRecipientRow) },
    keepOpen,
    successMessage: 'Zapisano odbiorców',
    onSubmitSuccess,
    action,
    // An edit form over a live row: a restored draft would revert an address somebody else changed
    // in the meantime. Also why three cards can share one store slot — nothing is kept in it.
    persistDraft: false,
    toData: (value) => value.emails.map((row) => row.email.trim()),
  })

  return (
    <FormShell form={form} onReset={reset}>
      <FieldGroup>
        <form.Field name="emails" mode="array">
          {(emailsField: EmailsArrayFieldT) => (
            <div className="space-y-3">
              {emailsField.state.value.map((row, index) => (
                <div key={row.id} className="flex items-end gap-2">
                  {/* type="email" fires native validation before Zod, so the app's own message
                      rarely shows — accepted: the save is blocked either way, and `text` would lose
                      the mobile e-mail keyboard and autofill. */}
                  <form.AppField name={`emails[${index}].email`}>
                    {(field) => (
                      <field.Input
                        label={index === 0 ? 'Adresy e-mail' : undefined}
                        type="email"
                        placeholder="ktos@wykonczymy.com.pl"
                        showError
                        fieldClassName="min-w-0 flex-1"
                      />
                    )}
                  </form.AppField>
                  <RemoveButton
                    onClick={() => emailsField.removeValue(index)}
                    // The last row is what „nie może być pusta" means at this end of the write —
                    // the action refuses an empty list, so let nobody build one to submit.
                    disabled={emailsField.state.value.length === 1}
                    aria-label="Usuń odbiorcę"
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => emailsField.pushValue(makeRecipientRow())}
              >
                Dodaj odbiorcę
              </Button>
            </div>
          )}
        </form.Field>
      </FieldGroup>
      <FormFooter label="Zapisz" submittingLabel="Zapisywanie..." className="mt-6" />
    </FormShell>
  )
}
