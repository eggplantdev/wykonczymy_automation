'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Description } from '@/components/ui/description'
import { EYEBROW_CLASS } from '@/components/ui/section-header'

type AuditGroupPropsT = {
  id: string
  title: string
  count: string
  proposal: ReactNode
  drift: ReactNode[]
  after?: ReactNode
  children: ReactNode
}

function subscribeHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function AuditGroup({
  id,
  title,
  count,
  proposal,
  drift,
  after,
  children,
}: AuditGroupPropsT) {
  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash,
    () => '',
  )
  const isTarget = hash === `#${id}`

  return (
    <CollapsibleSection
      // Remounting on a table-of-contents jump is what opens the targeted group.
      key={isTarget ? 'target' : 'rest'}
      id={id}
      title={`${id} · ${title}`}
      defaultOpen={isTarget}
      className="scroll-mt-4"
    >
      <div className="flex flex-col gap-4 pt-2 pb-6">
        <Description withIcon={false}>{count}</Description>
        <div className="flex flex-col gap-1">
          <h3 className={EYEBROW_CLASS}>Różnice</h3>
          <ul className="ml-4 list-disc text-sm">
            {drift.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className={EYEBROW_CLASS}>Propozycja</h3>
          <p className="text-sm">{proposal}</p>
        </div>
        {after}
        {after && <h3 className={EYEBROW_CLASS}>Przed</h3>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      </div>
    </CollapsibleSection>
  )
}
