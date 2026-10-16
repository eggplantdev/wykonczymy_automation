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

type AppManagedTabT = {
  cfg: SheetTabConfigT
  summaryKeys: (payload: Payload) => string[] | Promise<string[]>
}

export const APP_MANAGED_TABS: AppManagedTabT[] = [
  { cfg: EXPENSES_TAB_CONFIG, summaryKeys: getExpenseTypeNames },
  { cfg: SETTLED_TAB_CONFIG, summaryKeys: getExpenseTypeNames },
  { cfg: TRANSFERS_TAB_CONFIG, summaryKeys: transferSummaryKeys },
]

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
