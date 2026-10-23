import 'server-only'
import type { Payload } from 'payload'
import type { InvestmentAiStageT } from '@/lib/constants/investment-ai-stage'
import type { DbExecutorT } from '@/lib/db/get-db'
import { selectLiveUserIdsByEmails } from '@/lib/db/users-by-email'
import { readRecipientLists, type RecipientListT } from '@/lib/email/recipients'
import { translate } from '@/lib/i18n/translations'
import { isPushConfigured, sendPushToUser } from '@/lib/push/send-push'
import { logError } from '@/lib/utils/log-error'

const PUSHED_STAGES = {
  ready_for_analysis: { list: 'aiPipeline', title: 'readyTitle', body: 'readyBody' },
  new_information: { list: 'aiPipeline', title: 'newInformationTitle', body: 'newInformationBody' },
  analyzed: { list: 'aiReviewers', title: 'analyzedTitle', body: 'analyzedBody' },
  review_done: { list: 'aiPipeline', title: 'reviewDoneTitle', body: 'reviewDoneBody' },
} as const satisfies Partial<
  Record<InvestmentAiStageT, { list: RecipientListT; title: string; body: string }>
>

type AiStageChangeT = {
  investmentId: number
  investmentName: string
  stage: InvestmentAiStageT | null
  actorId: number
}

export async function notifyAiStageChange(
  payload: Payload,
  db: DbExecutorT,
  { investmentId, investmentName, stage, actorId }: AiStageChangeT,
): Promise<void> {
  if (stage === null || !(stage in PUSHED_STAGES) || !isPushConfigured()) return
  const { list, title, body } = PUSHED_STAGES[stage as keyof typeof PUSHED_STAGES]

  try {
    const emails = (await readRecipientLists(payload))[list]
    const recipientIds = (await selectLiveUserIdsByEmails(db, emails)).filter(
      (id) => id !== actorId,
    )
    if (recipientIds.length === 0) {
      // TODO(EX-958) SENTRY-REQUIRED: a stage push with no live recipient reaches nobody silently.
      logError('[PUSH] AI stage list has no live recipient', undefined, { list, investmentId })
      return
    }

    await Promise.all(
      recipientIds.map(async (userId) => {
        try {
          await sendPushToUser(db, userId, (locale) => ({
            title: translate(locale, 'aiStagePush', title),
            body: translate(locale, 'aiStagePush', body, { investment: investmentName }),
            url: `/inwestycje/${investmentId}`,
            tag: `ai-stage-${investmentId}`,
          }))
        } catch (err) {
          // TODO(EX-958) SENTRY-REQUIRED: a refused push is invisible to the user who missed it.
          logError('[PUSH] AI stage notification aborted', err, { userId, investmentId })
        }
      }),
    )
  } catch (err) {
    // TODO(EX-958) SENTRY-REQUIRED: a refused push is invisible to the user who missed it.
    logError('[PUSH] AI stage notification aborted', err, { investmentId })
  }
}
