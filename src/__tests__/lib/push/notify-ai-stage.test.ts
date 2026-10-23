import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import type * as SendPushModule from '@/lib/push/send-push'

const {
  sendPushToUser,
  isPushConfigured,
  readRecipientLists,
  selectLiveUserIdsByEmails,
  logError,
} = vi.hoisted(() => ({
  sendPushToUser: vi.fn<typeof SendPushModule.sendPushToUser>(),
  isPushConfigured: vi.fn(),
  readRecipientLists: vi.fn(),
  selectLiveUserIdsByEmails: vi.fn(),
  logError: vi.fn(),
}))
vi.mock('@/lib/push/send-push', () => ({ sendPushToUser, isPushConfigured }))
vi.mock('@/lib/email/recipients', () => ({ readRecipientLists }))
vi.mock('@/lib/db/users-by-email', () => ({ selectLiveUserIdsByEmails }))
vi.mock('@/lib/utils/log-error', () => ({ logError }))
vi.mock('@/lib/db/get-db', () => ({ getDb: async () => ({}) }))

import { notifyAiStageChange } from '@/lib/push/notify-ai-stage'

const payload = {} as Payload

const ADMIN = 15
const REVIEWER_A = 16
const REVIEWER_B = 18

const IDS_BY_EMAIL: Record<string, number> = {
  'admin@test.local': ADMIN,
  'reviewer-a@test.local': REVIEWER_A,
  'reviewer-b@test.local': REVIEWER_B,
}

const change = (stage: Parameters<typeof notifyAiStageChange>[1]['stage'], actorId = 1) =>
  notifyAiStageChange(payload, {
    investmentId: 42,
    investmentName: 'Mieszkanie Testowa',
    stage,
    actorId,
  })

const recipients = () => sendPushToUser.mock.calls.map(([, userId]) => userId).sort()

const messageTo = (userId: number) => {
  const call = sendPushToUser.mock.calls.find(([, id]) => id === userId)
  if (!call) throw new Error(`no push to user ${userId}`)
  return call[2]('pl')
}

describe('notifyAiStageChange', () => {
  beforeEach(() => {
    sendPushToUser.mockReset().mockResolvedValue(1)
    isPushConfigured.mockReset().mockReturnValue(true)
    logError.mockReset()
    readRecipientLists.mockReset().mockResolvedValue({
      aiPipeline: ['admin@test.local'],
      aiReviewers: ['reviewer-a@test.local', 'reviewer-b@test.local'],
    })
    selectLiveUserIdsByEmails
      .mockReset()
      .mockImplementation(async (_db, emails: string[]) =>
        emails.map((email) => IDS_BY_EMAIL[email]),
      )
  })

  it.each(['ready_for_analysis', 'new_information', 'review_done'] as const)(
    'pushes %s to the AI pipeline list',
    async (stage) => {
      await change(stage)
      expect(recipients()).toEqual([ADMIN])
    },
  )

  it('pushes Przeanalizowana to both reviewers', async () => {
    await change('analyzed')
    expect(recipients()).toEqual([REVIEWER_A, REVIEWER_B])
  })

  it('tags per investment and links to it', async () => {
    await change('analyzed')
    expect(messageTo(REVIEWER_A)).toMatchObject({ tag: 'ai-stage-42', url: '/inwestycje/42' })
    expect(messageTo(REVIEWER_A).body).toContain('Mieszkanie Testowa')
  })

  it('skips the account that made the change', async () => {
    await change('analyzed', REVIEWER_A)
    expect(recipients()).toEqual([REVIEWER_B])
  })

  it.each(['knowledge_extracted', null] as const)('sends nothing for %s', async (stage) => {
    await change(stage)
    expect(readRecipientLists).not.toHaveBeenCalled()
    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('reads nothing and sends nothing without the production keys', async () => {
    isPushConfigured.mockReturnValue(false)
    await change('analyzed')
    expect(readRecipientLists).not.toHaveBeenCalled()
    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('stays quiet when the only recipient made the change', async () => {
    await change('ready_for_analysis', ADMIN)
    expect(sendPushToUser).not.toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()
  })

  it('logs an empty list instead of throwing', async () => {
    selectLiveUserIdsByEmails.mockResolvedValue([])
    await expect(change('ready_for_analysis')).resolves.toBeUndefined()
    expect(sendPushToUser).not.toHaveBeenCalled()
    expect(logError).toHaveBeenCalled()
  })
})
