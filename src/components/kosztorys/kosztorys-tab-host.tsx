'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

type TabKeyT = 'kosztorys' | 'arkusz'

type PropsT = {
  editor: ReactNode
  sheet: ReactNode
}

// Two coexisting views of one investment's kosztorys: the in-app editor and the legacy Google
// Sheet ("Arkusz"), until the sheet flow is retired (FR-016). The editor stays mounted so its
// unsaved debounced edits survive a flip to the sheet and back. Arkusz is the default landing
// view for now, so the sheet mounts eagerly; the editor stays mounted alongside it.
export function KosztorysTabHost({ editor, sheet }: PropsT) {
  const [tab, setTab] = useState<TabKeyT>('arkusz')
  const [sheetSeen, setSheetSeen] = useState(true)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1">
        <Button
          size="sm"
          variant={tab === 'kosztorys' ? 'default' : 'outline'}
          onClick={() => setTab('kosztorys')}
        >
          Kosztorys
        </Button>
        <Button
          size="sm"
          variant={tab === 'arkusz' ? 'default' : 'outline'}
          onClick={() => {
            setTab('arkusz')
            setSheetSeen(true)
          }}
        >
          Arkusz
        </Button>
      </div>
      <div className={tab === 'kosztorys' ? '' : 'hidden'}>{editor}</div>
      {sheetSeen && <div className={tab === 'arkusz' ? '' : 'hidden'}>{sheet}</div>}
    </div>
  )
}
