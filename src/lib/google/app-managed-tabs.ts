import type { Payload } from 'payload'
import {
  ensureTab,
  EXPENSES_TAB_CONFIG,
  SETTLED_TAB_CONFIG,
  setupTab,
  TRANSFERS_TAB_CONFIG,
  transferSummaryKeys,
  type SheetTabConfigT,
} from './sheets'
import { getExpenseTypeNames } from './expense-categories'

// The create/reset plane's registry — the twin of the per-tab sync specs in
// sheets-sync.ts. One entry per app-managed tab, in stamp order. `summaryKeys` is the
// per-tab source for the SUMIF summary: the expense-shaped tabs read the current
// category set from the DB; the transfers tab uses a static list. Adding a tab is one
// entry here, not a hand-unrolled call in every setup/link/add path.
type AppManagedTabT = {
  cfg: SheetTabConfigT
  summaryKeys: (payload: Payload) => string[] | Promise<string[]>
}

export const APP_MANAGED_TABS: AppManagedTabT[] = [
  { cfg: EXPENSES_TAB_CONFIG, summaryKeys: getExpenseTypeNames },
  { cfg: SETTLED_TAB_CONFIG, summaryKeys: getExpenseTypeNames },
  { cfg: TRANSFERS_TAB_CONFIG, summaryKeys: transferSummaryKeys },
]

// Stamp every app-managed tab on a sheet.
// - `'setup'` (reset button): destructive rebuild — clears + re-templates each tab.
// - `'ensure'` (link / add): create-if-missing — never wipes an existing tab, and the
//   keys are resolved lazily so an already-present tab costs no category lookup.
export async function stampAllTabs(
  spreadsheetId: string,
  payload: Payload,
  mode: 'setup' | 'ensure',
): Promise<void> {
  for (const tab of APP_MANAGED_TABS) {
    if (mode === 'setup') await setupTab(spreadsheetId, tab.cfg, await tab.summaryKeys(payload))
    else await ensureTab(spreadsheetId, tab.cfg, () => tab.summaryKeys(payload))
  }
}
