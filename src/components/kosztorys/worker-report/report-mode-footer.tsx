'use client'

import { createPortal } from 'react-dom'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { useTranslation } from '@/hooks/use-translation'

export type ReportViewModeT = 'report' | 'summary'

type PropsT = {
  mode: ReportViewModeT
  onModeChange: (mode: ReportViewModeT) => void
}

export function ReportModeFooter({ mode, onModeChange }: PropsT) {
  const { t } = useTranslation('report')

  // Portaled: an ancestor in the grid's footer slot is a containing block for `fixed`, which would
  // pin the bar to the bottom of the page instead of the screen. Mounted client-side only — the
  // grid waits for the draft to load.
  return createPortal(
    <nav className="border-border bg-background fixed inset-x-0 bottom-0 z-40 flex justify-center border-t px-4 py-3">
      <ToggleGroup
        size="lg"
        isEqualWidth
        options={[
          { value: 'report', label: t('reportTab') },
          { value: 'summary', label: t('investmentTab') },
        ]}
        value={mode}
        onChange={onModeChange}
      />
    </nav>,
    document.body,
  )
}
