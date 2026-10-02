'use server'

import { requestReviewSchema } from '@/components/forms/request-review-form/request-review-schema'
import { sendReviewRequestEmail } from '@/lib/investments/review-request-email'
import { validateAction, protectedAction } from './run-action'
import { logError } from '@/lib/utils/log-error'
import { INVESTMENT_TRASHED_MESSAGE, investmentLockOf } from '@/lib/constants/investment-lock'

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
      const lock = investmentLockOf({
        status: investment.status,
        trashed: Boolean(investment.trashedAt),
      })
      if (lock === 'trashed') return { success: false, error: INVESTMENT_TRASHED_MESSAGE }
      if (lock !== 'completed') {
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

      // The mail is out, so a failed write must not read as a failed send — a retry would mail the
      // client twice.
      try {
        await payload.update({
          collection: 'investments',
          id: investmentId,
          data: { email: parsed.data.email, reviewRequested: true },
          user,
        })
      } catch (error) {
        // TODO(EX-449) SENTRY-REQUIRED: a sent review request the flag doesn't record.
        logError('[requestReviewAction] flag write failed', error)
        return {
          success: true,
          warning: 'Wiadomość wysłana, ale nie udało się zapisać znacznika — zaznacz go ręcznie.',
        }
      }

      return { success: true }
    },
    ['investments'],
  )
}
