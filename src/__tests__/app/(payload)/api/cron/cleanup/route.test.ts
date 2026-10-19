import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/lib/db/get-db', () => ({ getDb: vi.fn() }))
vi.mock('@/lib/kosztorys/snapshot-gc', () => ({
  gcSnapshots: vi.fn(),
  gcTemplateSnapshots: vi.fn(),
}))
vi.mock('@/lib/investments/purge-trash', () => ({ purgeTrash: vi.fn() }))
vi.mock('@/lib/cash-registers/purge-trash', () => ({ purgeCashRegisterTrash: vi.fn() }))
vi.mock('@/lib/workers/purge-trash', () => ({ purgeWorkerTrash: vi.fn() }))
vi.mock('@/lib/fleet/purge-trash', () => ({ purgeVehicleTrash: vi.fn() }))
vi.mock('@/lib/equipment/purge-trash', () => ({ purgeEquipmentTrash: vi.fn() }))
vi.mock('@/lib/leads/purge-trash', () => ({ purgeLeadTrash: vi.fn() }))
vi.mock('@/lib/kosztorys/templates/purge-trash', () => ({ purgeTemplateTrash: vi.fn() }))
vi.mock('@/lib/media/gc-media', () => ({ gcMedia: vi.fn() }))

import { GET } from '@/app/(payload)/api/cron/cleanup/route'
import { getPayload } from 'payload'
import { gcSnapshots, gcTemplateSnapshots } from '@/lib/kosztorys/snapshot-gc'
import { purgeTrash } from '@/lib/investments/purge-trash'
import { purgeCashRegisterTrash } from '@/lib/cash-registers/purge-trash'
import { purgeWorkerTrash } from '@/lib/workers/purge-trash'
import { purgeVehicleTrash } from '@/lib/fleet/purge-trash'
import { purgeEquipmentTrash } from '@/lib/equipment/purge-trash'
import { purgeLeadTrash } from '@/lib/leads/purge-trash'
import { purgeTemplateTrash } from '@/lib/kosztorys/templates/purge-trash'
import { gcMedia } from '@/lib/media/gc-media'
import { revalidateTag } from '@/__tests__/stubs/next-cache'
import { CACHE_TAGS } from '@/lib/cache/tags'

const RESULTS = {
  snapshots: { deleted: 7, ceiling: 2, daily: 4, weekly: 1, investorExpired: 0 },
  trash: { purged: 2, skippedKosztorys: 1, blocked: 0, failed: 0 },
  cashRegisterTrash: { purged: 1, blocked: 0, failed: 0 },
  workerTrash: { purged: 1, blocked: 1, failed: 0 },
  vehicleTrash: { purged: 1, blocked: 0, failed: 0 },
  equipmentTrash: { purged: 2, blocked: 0, failed: 0 },
  leadTrash: { purged: 3, blocked: 0, failed: 0 },
  templateSnapshots: { deleted: 2, ceiling: 1, daily: 1, weekly: 0 },
  templateTrash: { purged: 1, blocked: 0, failed: 0 },
  media: { recorded: 3, healed: 1, deleted: 2, failed: 0 },
}
const STEPS = {
  snapshots: gcSnapshots,
  trash: purgeTrash,
  cashRegisterTrash: purgeCashRegisterTrash,
  workerTrash: purgeWorkerTrash,
  vehicleTrash: purgeVehicleTrash,
  equipmentTrash: purgeEquipmentTrash,
  leadTrash: purgeLeadTrash,
  templateSnapshots: gcTemplateSnapshots,
  templateTrash: purgeTemplateTrash,
  media: gcMedia,
}
type StepT = keyof typeof STEPS

describe('cron cleanup route', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    for (const step of Object.keys(STEPS) as StepT[]) {
      vi.mocked(STEPS[step]).mockResolvedValue(RESULTS[step] as never)
    }
  })

  function request(headers: Record<string, string> = {}) {
    return new NextRequest('http://localhost/api/cron/cleanup', { headers })
  }
  const authorized = () => GET(request({ authorization: 'Bearer test-secret' }))

  it('rejects a request with no Authorization header', async () => {
    const res = await GET(request())
    expect(res.status).toBe(401)
    expect(getPayload).not.toHaveBeenCalled()
  })

  it('forwards every step’s breakdown on an authorized request', async () => {
    const res = await authorized()

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true, ...RESULTS })
    expect(revalidateTag).toHaveBeenCalledWith(CACHE_TAGS.kosztorysSnapshots, { expire: 0 })
  })

  it.each(Object.keys(STEPS) as StepT[])(
    'still reports every other step when %s throws',
    async (failing) => {
      vi.mocked(STEPS[failing]).mockRejectedValue(new Error('boom'))

      const res = await authorized()

      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({ ok: false, ...RESULTS, [failing]: null })
    },
  )

  it('fails only when every step does', async () => {
    for (const step of Object.values(STEPS)) vi.mocked(step).mockRejectedValue(new Error('boom'))
    const res = await authorized()
    expect(res.status).toBe(500)
  })
})
