'use client'

import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SheetReportBlock } from '@/components/kosztorys/editor/dialogs/report/sheet-report-block'
import type {
  SheetFailureReasonT,
  SheetFailureT,
} from '@/lib/kosztorys/sheet-import/classify-sheet-failure'
import { LABOR_TAB } from '@/lib/kosztorys/sheet-import/read-sheet'
import { copyToClipboard } from '@/lib/utils/copy-to-clipboard'

/**
 * Why the sheet could not be read — one sentence per reason, each naming a DIFFERENT thing to do.
 * Shared by both sheet windows: they read the same sheet down the same path, so two accounts of the
 * same failure would be pure debt.
 */
const VERDICTS: Record<SheetFailureReasonT, string> = {
  forbidden:
    'Ta aplikacja nie ma dostępu do arkusza. Udostępnij go jako Przeglądający adresowi poniżej, a potem spróbuj ponownie.',
  'not-found':
    'Arkusz o tym identyfikatorze nie istnieje albo został usunięty. Popraw powiązanie arkusza w ustawieniach inwestycji — czekanie tu nie pomoże.',
  'missing-tab': `Arkusz nie ma zakładki „${LABOR_TAB}", a to z niej czytamy prace. Sprawdź, czy nie została przemianowana.`,
  unknown: 'Google nie odpowiedział. Spróbuj za chwilę — nic nie zostało zmienione.',
}

export function SheetAccessBlock({ failure }: { failure: SheetFailureT }) {
  const { reason, serviceAccountEmail } = failure
  return (
    <SheetReportBlock
      title="Nie udało się odczytać arkusza Google"
      status="warn"
      verdict={VERDICTS[reason]}
    >
      {serviceAccountEmail && (
        <div className="flex flex-wrap items-center gap-2">
          <code className="bg-muted rounded px-2 py-1 text-xs break-all">
            {serviceAccountEmail}
          </code>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copyToClipboard(serviceAccountEmail, 'Skopiowano adres konta usługi')}
          >
            <Copy />
            Kopiuj adres
          </Button>
        </div>
      )}
    </SheetReportBlock>
  )
}
