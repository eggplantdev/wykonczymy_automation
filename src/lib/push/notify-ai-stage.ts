import 'server-only'
import type { Payload } from 'payload'
import type { InvestmentAiStageT } from '@/lib/constants/investment-ai-stage'
import { getDb } from '@/lib/db/get-db'
import { selectLiveUserIdsByEmails } from '@/lib/db/users-by-email'
import { readRecipientLists, type RecipientListT } from '@/lib/email/recipients'
import { translate, type MessageKeyT } from '@/lib/i18n/translations'
import { isPushConfigured, sendPushToUser } from '@/lib/push/send-push'
import { logError } from '@/lib/utils/log-error'

type StagePushT = {
  list: RecipientListT
  title: MessageKeyT<'aiStagePush'>
  body: MessageKeyT<'aiStagePush'>
}

const PUSHED_STAGES: Partial<Record<InvestmentAiStageT, StagePushT>> = {
  ready_for_analysis: { list: 'aiPipeline', title: 'readyTitle', body: 'readyBody' },
  new_information: { list: 'aiPipeline', title: 'newInformationTitle', body: 'newInformationBody' },
  analyzed: { list: 'aiReviewers', title: 'analyzedTitle', body: 'analyzedBody' },
  review_done: { list: 'aiPipeline', title: 'reviewDoneTitle', body: 'reviewDoneBody' },
}

type AiStageChangeT = {
  investmentId: number
  investmentName: string
  stage: InvestmentAiStageT | null
  actorId: number
}

export async function notifyAiStageChange(
  payload: Payload,
  { investmentId, investmentName, stage, actorId }: AiStageChangeT,
): Promise<void> {
  const pushed = stage === null ? undefined : PUSHED_STAGES[stage]
  if (!pushed || !isPushConfigured()) return
  const { list, title, body } = pushed

  try {
    const db = await getDb(payload)
    const emails = (await readRecipientLists(payload))[list]
    const liveIds = await selectLiveUserIdsByEmails(db, emails)
    if (liveIds.length === 0) {
      // TODO(EX-958) SENTRY-REQUIRED: a stage push with no live recipient reaches nobody silently.
      logError('[PUSH] AI stage list has no live recipient', undefined, { list, investmentId })
      return
    }
    const recipientIds = liveIds.filter((id) => id !== actorId)

    await Promise.all(
      recipientIds.map((userId) =>
        sendPushToUser(db, userId, (locale) => ({
          title: translate(locale, 'aiStagePush', title),
          body: translate(locale, 'aiStagePush', body, { investment: investmentName }),
          url: `/inwestycje/${investmentId}`,
          tag: `ai-stage-${investmentId}`,
        })),
      ),
    )
  } catch (err) {
    // TODO(EX-958) SENTRY-REQUIRED: a refused push is invisible to the user who missed it.
    logError('[PUSH] AI stage notification aborted', err, { investmentId })
  }
}
