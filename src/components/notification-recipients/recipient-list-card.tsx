'use client'

import { Mail } from 'lucide-react'
import { EditButton } from '@/components/ui/row-actions/edit-button'
import { Description } from '@/components/ui/description'
import { FormDialog } from '@/components/ui/form-dialog'
import { RecipientListForm } from '@/components/forms/recipient-list-form/recipient-list-form'
import { saveRecipientListAction } from '@/lib/actions/notification-recipients'
import type { RecipientListT } from '@/lib/email/recipients'

type RecipientListCardPropsT = {
  list: RecipientListT
  title: string
  /** How this stream decides what to send — the card is the only place anyone asks. */
  description?: React.ReactNode
  emails: string[]
  /** Reading is `MANAGEMENT_ROLES` (the page's own gate); writing is owner/admin, as the action is. */
  canEdit: boolean
}

/**
 * Who gets one stream's notifications, shown on the page whose notifications they are.
 *
 * That placement is the whole point (owner, 2026-08-26): the complaint these lists answer was „I
 * can't see who gets notified", which a settings page — or /admin — would leave untouched.
 */
export function RecipientListCard({
  list,
  title,
  description,
  emails,
  canEdit,
}: RecipientListCardPropsT) {
  return (
    <section className="border-border rounded-md border p-4">
      <div className="flex items-center gap-2">
        <Mail className="text-muted-foreground size-4 shrink-0" />
        <h2 className="flex-1 text-sm font-semibold">{title}</h2>
        {canEdit && (
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
        )}
      </div>
      {description && (
        <Description size="xs" className="mt-2">
          {description}
        </Description>
      )}
      {emails.length === 0 ? (
        // A stream with nobody in it makes its sender throw, so the page has to say so — an empty
        // line reads as "nothing to see here".
        <Description tone="error" size="xs" className="mt-2">
          Nikt nie dostanie tych powiadomień — wysyłka zgłosi błąd.
        </Description>
      ) : (
        <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
          {emails.map((email) => (
            <li key={email}>{email}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
