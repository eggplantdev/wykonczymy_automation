import {
  deleteCashRegisterForeverAction,
  restoreCashRegisterAction,
} from '@/lib/actions/cash-register-trash'
import {
  deleteInvestmentForeverAction,
  restoreInvestmentAction,
} from '@/lib/actions/investment-trash'
import { deleteWorkerForeverAction, restoreWorkerAction } from '@/lib/actions/worker-trash'
import { INVESTMENT_DELETE_FAILED_MESSAGE, KOSZTORYS_IN_USE_WARNING } from '@/lib/constants/trash'
import type { ActionResultT } from '@/types/action'
import type { TrashKindT } from '@/types/trash'

type TrashKindConfigT = {
  sectionTitle: string
  restore: (id: number) => Promise<ActionResultT>
  restored: string
  deleteForever: (id: number, confirmName?: string) => Promise<ActionResultT>
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
    askReason: KOSZTORYS_IN_USE_WARNING,
    nameLabel: 'Nazwa inwestycji',
    deleted: 'Inwestycja usunięta na zawsze.',
    failed: INVESTMENT_DELETE_FAILED_MESSAGE,
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
  worker: {
    sectionTitle: 'Pracownicy',
    restore: restoreWorkerAction,
    restored: 'Pracownik przywrócony razem ze swoimi kasami.',
    deleteForever: (id, confirmName) => deleteWorkerForeverAction(id, confirmName ?? ''),
    lost: 'jego kasy z kosza oraz jego nazwisko na anulowanych transakcjach',
    askReason: 'Konto zniknie razem z kasami, które poszły z nim do kosza.',
    nameLabel: 'Imię i nazwisko',
    deleted: 'Pracownik usunięty na zawsze.',
    failed: 'Nie udało się usunąć pracownika',
  },
}

export const TRASH_KIND_ORDER = Object.keys(TRASH_KINDS) as TrashKindT[]
