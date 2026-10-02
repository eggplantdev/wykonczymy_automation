import {
  deleteCashRegisterForeverAction,
  restoreCashRegisterAction,
} from '@/lib/actions/cash-register-trash'
import {
  deleteInvestmentForeverAction,
  restoreInvestmentAction,
} from '@/lib/actions/investment-trash'
import { deleteWorkerForeverAction, restoreWorkerAction } from '@/lib/actions/worker-trash'
import { deleteVehicleForeverAction, restoreVehicleAction } from '@/lib/actions/vehicle-trash'
import { deleteEquipmentForeverAction, restoreEquipmentAction } from '@/lib/actions/equipment-trash'
import { deleteLeadForeverAction, restoreLeadAction } from '@/lib/actions/lead-trash'
import { KOSZTORYS_IN_USE_WARNING } from '@/lib/constants/trash'
import type { ActionResultT } from '@/types/action'
import type { TrashKindT, TrashRowT } from '@/types/trash'

type TrashKindConfigT = {
  sectionTitle: string
  restore: (id: number) => Promise<ActionResultT>
  restored: string
  deleteForever: (id: number, confirmName: string) => Promise<ActionResultT>
  lost?: string
  note?: (row: TrashRowT) => string | undefined
  nameLabel: string
  deleted: string
}

// Declaration order is the order of the /kosz sections.
export const TRASH_KINDS: Record<TrashKindT, TrashKindConfigT> = {
  investment: {
    sectionTitle: 'Inwestycje',
    restore: restoreInvestmentAction,
    restored: 'Inwestycja przywrócona.',
    deleteForever: deleteInvestmentForeverAction,
    lost: 'kosztorys (pozycje i wersje), przypięcia zdjęć, link dla inwestora',
    // Read the way the /kosz row reads it: no auto-purge means „kosztorys w użyciu".
    note: (row) => (row.autoPurges ? undefined : KOSZTORYS_IN_USE_WARNING),
    nameLabel: 'Nazwa inwestycji',
    deleted: 'Inwestycja usunięta na zawsze.',
  },
  template: {
    sectionTitle: 'Szablony',
    restore: restoreInvestmentAction,
    restored: 'Szablon przywrócony.',
    deleteForever: deleteInvestmentForeverAction,
    lost: 'sekcje, pozycje i wersje szablonu',
    note: () => 'Kosztorysy założone z tego szablonu zostają bez zmian.',
    nameLabel: 'Nazwa szablonu',
    deleted: 'Szablon usunięty na zawsze.',
  },
  'cash-register': {
    sectionTitle: 'Kasy',
    restore: restoreCashRegisterAction,
    restored: 'Kasa przywrócona.',
    deleteForever: deleteCashRegisterForeverAction,
    nameLabel: 'Nazwa kasy',
    deleted: 'Kasa usunięta na zawsze.',
  },
  worker: {
    sectionTitle: 'Pracownicy',
    restore: restoreWorkerAction,
    restored: 'Pracownik przywrócony razem ze swoimi kasami.',
    deleteForever: deleteWorkerForeverAction,
    lost: 'jego kasy z kosza oraz jego nazwisko na anulowanych transakcjach',
    nameLabel: 'Imię i nazwisko',
    deleted: 'Pracownik usunięty na zawsze.',
  },
  vehicle: {
    sectionTitle: 'Flota',
    restore: restoreVehicleAction,
    restored: 'Pojazd przywrócony.',
    deleteForever: deleteVehicleForeverAction,
    lost: 'historia przeglądów i ich załączniki',
    nameLabel: 'Rejestracja',
    deleted: 'Pojazd usunięty na zawsze.',
  },
  equipment: {
    sectionTitle: 'Sprzęt',
    restore: restoreEquipmentAction,
    restored: 'Sprzęt przywrócony.',
    deleteForever: deleteEquipmentForeverAction,
    lost: 'historia przekazań',
    nameLabel: 'Nazwa sprzętu',
    deleted: 'Sprzęt usunięty na zawsze.',
  },
  lead: {
    sectionTitle: 'Zgłoszenia',
    restore: restoreLeadAction,
    restored: 'Zgłoszenie przywrócone.',
    deleteForever: deleteLeadForeverAction,
    lost: 'dane kontaktowe, odpowiedzi z formularza i pliki, których nie ma w żadnej inwestycji',
    note: () => 'Inwestycja założona z tego zgłoszenia i jej pliki zostają bez zmian.',
    nameLabel: 'Nazwa zgłoszenia',
    deleted: 'Zgłoszenie usunięte na zawsze.',
  },
}

export const TRASH_KIND_ORDER = Object.keys(TRASH_KINDS) as TrashKindT[]
