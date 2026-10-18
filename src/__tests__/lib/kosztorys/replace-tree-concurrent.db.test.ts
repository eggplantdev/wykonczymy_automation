import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { replaceTreeWithSnapshot } from '@/lib/kosztorys/replace-tree-with-snapshot'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { firstUserId } from '@/__tests__/helpers/user'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

describe.skipIf(!ENV_READY)('concurrent wholesale replacements (DB)', () => {
  let payload: Payload
  let investmentId: number
  let takenBy: number

  beforeAll(async () => {
    payload = await bootTestPayload()

    takenBy = await firstUserId(payload)

    investmentId = await createTestInvestment(payload, 'replace-tree-concurrent-test', {
      vatRate: 0.23,
      wToolsCoeff: 0.7,
      ownToolsCoeff: 0.5,
    })
    await createKosztorysTree(payload, investmentId, {
      sections: [
        {
          name: 'Sekcja A',
          items: [{ description: 'Malowanie', unit: 'm2', plannedQty: 10, clientPrice: 100 }],
        },
      ],
      stages: [{ label: 'Etap 1' }, { label: 'Etap 2' }],
    })
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  it('serializes overlapping replacements instead of failing the loser on a duplicate ordinal', async () => {
    const tree = {
      ...(await serializeKosztorys(investmentId)),
      stages: [1, 2, 3].map((ordinal) => ({
        id: ordinal,
        ordinal,
        label: null,
        plane: null,
        workerId: null,
      })),
      progress: [],
    }

    const results = await Promise.allSettled(
      [0, 1, 2].map((index) =>
        replaceTreeWithSnapshot(payload, {
          investmentId,
          label: `Zastąpienie ${index}`,
          takenBy,
          tree,
        }),
      ),
    )

    expect(results.filter((result) => result.status === 'rejected')).toEqual([])

    const after = await serializeKosztorys(investmentId)
    expect(after.stages.map((stage) => stage.ordinal)).toEqual([1, 2, 3])
  })
})
