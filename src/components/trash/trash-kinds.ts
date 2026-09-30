import {
  deleteCashRegisterForeverAction,
  restoreCashRegisterAction,
} from '@/lib/actions/cash-register-trash'
import {
  deleteInvestmentForeverAction,
  restoreInvestmentAction,
} from '@/lib/actions/investment-trash'
import type { ActionResultT } from '@/types/action'
import type { TrashKindT } from '@/types/trash'

type TrashKindConfigT = {
  sectionTitle: string
  restore: (id: number) => Promise<ActionResultT>
  restored: string
  deleteForever: (id: number, confirmName?: string) => Promise<ActionResultT>
  /** What goes with the row; omitted when the row takes nothing with it. */
  lost?: string
  /** Why the dialog asks for the name — only read by a kind whose rows can require it. */
  askReason?: string
  nameLabel: string
  deleted: string
  failed: string
}

// Declaration order is the order of the /kosz sections.
export const TRASH_KINDS: Record<TrashKindT, TrashKindConfigT> = {
  investment: {
    sectionTitle: 'Inwestycje',
    restore: restoreInvestmentAction,
    restored: 'Inwestycja przywrócona.',
    deleteForever: deleteInvestmentForeverAction,
    lost: 'kosztorys (pozycje i wersje), przypięcia zdjęć, link dla inwestora',
    askReason: 'Kosztorys tej inwestycji jest w użyciu.',
    nameLabel: 'Nazwa inwestycji',
    deleted: 'Inwestycja usunięta na zawsze.',
    failed: 'Nie udało się usunąć inwestycji',
  },
  template: {
    sectionTitle: 'Szablony',
    restore: restoreInvestmentAction,
    restored: 'Szablon przywrócony.',
    deleteForever: deleteInvestmentForeverAction,
    lost: 'sekcje, pozycje i wersje szablonu',
    askReason: 'Kosztorysy założone z tego szablonu zostają bez zmian.',
    nameLabel: 'Nazwa szablonu',
    deleted: 'Szablon usunięty na zawsze.',
    failed: 'Nie udało się usunąć szablonu',
  },
  'cash-register': {
    sectionTitle: 'Kasy',
    restore: restoreCashRegisterAction,
    restored: 'Kasa przywrócona.',
    deleteForever: deleteCashRegisterForeverAction,
    nameLabel: 'Nazwa kasy',
    deleted: 'Kasa usunięta na zawsze.',
    failed: 'Nie udało się usunąć kasy',
  },
}

export const TRASH_KIND_ORDER = Object.keys(TRASH_KINDS) as TrashKindT[]
