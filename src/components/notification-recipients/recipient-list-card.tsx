'use client'

import { Mail } from 'lucide-react'
import { EditButton } from '@/components/ui/row-actions/edit-button'
import { Description } from '@/components/ui/description'
import { SettingsCard } from '@/components/ui/settings-card'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { RecipientListForm } from '@/components/forms/recipient-list-form/recipient-list-form'
import { saveRecipientListAction } from '@/lib/actions/notification-recipients'
import type { RecipientListT } from '@/lib/email/recipients'

type RecipientListCardPropsT = {
  list: RecipientListT
  title: string
  description?: React.ReactNode
  emails: string[]
  canEdit: boolean
}

export function RecipientListCard({
  list,
  title,
  description,
  emails,
  canEdit,
}: RecipientListCardPropsT) {
  return (
    <SettingsCard
      icon={Mail}
      title={title}
      action={
        canEdit && (
          <FormDialog
            formId={`recipients-${list}`}
            title={title}
            description="Powiadomienia trafią na każdy z tych adresów."
            showKeepOpen={false}
            trigger={<EditButton type="button" label={`Edytuj listę: ${title}`} showLabel />}
          >
            {(onSubmitSuccess) => (
              <RecipientListForm
                formId={`recipients-${list}`}
                emails={emails}
                action={(next) => saveRecipientListAction(list, next)}
                onSubmitSuccess={onSubmitSuccess}
              />
            )}
          </FormDialog>
        )
      }
    >
      {description && (
        <Description size="xs" className="mt-2">
          {description}
        </Description>
      )}
      {emails.length === 0 ? (
        <Description tone="error" withIcon size="xs" className="mt-2">
          Nikt nie dostanie tych powiadomień — wysyłka zgłosi błąd.
        </Description>
      ) : (
        <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
          {emails.map((email) => (
            <li key={email}>{email}</li>
          ))}
        </ul>
      )}
    </SettingsCard>
  )
}
