'use server'

import { requestReviewSchema } from '@/components/forms/request-review-form/request-review-schema'
import { sendReviewRequestEmail } from '@/lib/investments/review-request-email'
import { validateAction, protectedAction } from './run-action'
import { logError } from '@/lib/utils/log-error'

// Not `investmentAction`: it refuses every write on a zakończona inwestycja, and this is the one
// action that exists only for those.
export async function requestReviewAction(investmentId: number, email: string) {
  return protectedAction(
    'requestReviewAction',
    async ({ payload, user }) => {
      const parsed = validateAction(requestReviewSchema, { email })
      if (!parsed.success) return parsed

      const investment = await payload.findByID({
        collection: 'investments',
        id: investmentId,
        depth: 0,
        overrideAccess: true,
      })
      // Checked before the send, not left to `guardTrashedInvestment`: that guard refuses the
      // write, by which point the mail is already out.
      if (investment.trashedAt) {
        return { success: false, error: 'Inwestycja jest w koszu.' }
      }
      if (investment.status !== 'completed') {
        return {
          success: false,
          error: 'Prośbę o opinię można wysłać tylko dla zakończonej inwestycji.',
        }
      }

      // Send first: a failed send writes nothing, so the flag never claims a mail that didn't leave.
      try {
        await sendReviewRequestEmail(payload, parsed.data.email)
      } catch (error) {
        // TODO(EX-449) SENTRY-REQUIRED: a client-facing mail that never left.
        logError('[requestReviewAction] send failed', error)
        return { success: false, error: 'Nie udało się wysłać wiadomości. Spróbuj ponownie.' }
      }

      await payload.update({
        collection: 'investments',
        id: investmentId,
        data: { email: parsed.data.email, reviewRequested: true },
        user,
      })

      return { success: true }
    },
    ['investments'],
  )
}
