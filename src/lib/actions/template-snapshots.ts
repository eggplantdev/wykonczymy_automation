'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { templateAction } from '@/lib/actions/template-action'
import type { RestoreResultT, SnapshotListItemT } from '@/lib/actions/kosztorys-snapshots'
import type { ActionResultT } from '@/types/action'

const NO_TEMPLATE_VERSIONS = 'Wersje szablonu nie są jeszcze dostępne.'

export async function templateSnapshotAction(_templateId: number): Promise<ActionResultT> {
  return protectedAction('templateSnapshotAction', async () => ({ success: true }))
}

export async function saveTemplateSnapshotAction(
  templateId: number,
  _label: string,
): Promise<ActionResultT> {
  return templateAction(
    'saveTemplateSnapshotAction',
    { kind: 'template', id: templateId },
    async () => ({ success: false, error: NO_TEMPLATE_VERSIONS }),
  )
}

export async function restoreTemplateSnapshotAction(
  _snapshotId: number,
  templateId: number,
): Promise<ActionResultT<RestoreResultT>> {
  return templateAction(
    'restoreTemplateSnapshotAction',
    { kind: 'template', id: templateId },
    async () => ({ success: false, error: NO_TEMPLATE_VERSIONS }),
  )
}

export async function listTemplateSnapshotsAction(
  _templateId: number,
): Promise<ActionResultT<SnapshotListItemT[]>> {
  return protectedAction('listTemplateSnapshotsAction', async () => ({ success: true, data: [] }))
}
