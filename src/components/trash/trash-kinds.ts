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
import { deleteTemplateForeverAction, restoreTemplateAction } from '@/lib/actions/template-trash'
import { restoreDetachedFileAction } from '@/lib/actions/media-trash'
import { KOSZTORYS_IN_USE_WARNING } from '@/lib/constants/trash'
import type { ActionResultT } from '@/types/action'
import type { TrashKindT, TrashRowT } from '@/types/trash'

export type DeleteForeverConfigT = {
  note?: (row: TrashRowT) => string | undefined
  action: (id: number, confirmName: string) => Promise<ActionResultT>
  lost?: string
  nameLabel: string
  deleted: string
}

type TrashKindConfigT = {
  sectionTitle: string
  restore: (id: number) => Promise<ActionResultT>
  restored: string
  deleteForever?: DeleteForeverConfigT
}

// Declaration order is the order of the /kosz sections.
export const TRASH_KINDS: Record<TrashKindT, TrashKindConfigT> = {
  investment: {
    sectionTitle: 'Inwestycje',
    restore: restoreInvestmentAction,
    restored: 'Inwestycja przywrócona.',
    deleteForever: {
      note: (row) => (row.autoPurges ? undefined : KOSZTORYS_IN_USE_WARNING),
      action: deleteInvestmentForeverAction,
      lost: 'kosztorys (pozycje i wersje), przypięcia zdjęć, link dla inwestora',
      nameLabel: 'Nazwa inwestycji',
      deleted: 'Inwestycja usunięta na zawsze.',
    },
  },
  template: {
    sectionTitle: 'Szablony',
    restore: restoreTemplateAction,
    restored: 'Szablon przywrócony.',
    deleteForever: {
      note: () => 'Kosztorysy założone z tego szablonu zostają bez zmian.',
      action: deleteTemplateForeverAction,
      lost: 'sekcje, pozycje i wersje szablonu',
      nameLabel: 'Nazwa szablonu',
      deleted: 'Szablon usunięty na zawsze.',
    },
  },
  'cash-register': {
    sectionTitle: 'Kasy',
    restore: restoreCashRegisterAction,
    restored: 'Kasa przywrócona.',
    deleteForever: {
      action: deleteCashRegisterForeverAction,
      nameLabel: 'Nazwa kasy',
      deleted: 'Kasa usunięta na zawsze.',
    },
  },
  worker: {
    sectionTitle: 'Pracownicy',
    restore: restoreWorkerAction,
    restored: 'Pracownik przywrócony razem ze swoimi kasami.',
    deleteForever: {
      action: deleteWorkerForeverAction,
      lost: 'jego kasy z kosza oraz jego nazwisko na anulowanych transakcjach',
      nameLabel: 'Imię i nazwisko',
      deleted: 'Pracownik usunięty na zawsze.',
    },
  },
  vehicle: {
    sectionTitle: 'Flota',
    restore: restoreVehicleAction,
    restored: 'Pojazd przywrócony.',
    deleteForever: {
      action: deleteVehicleForeverAction,
      lost: 'historia przeglądów i ich załączniki',
      nameLabel: 'Rejestracja',
      deleted: 'Pojazd usunięty na zawsze.',
    },
  },
  equipment: {
    sectionTitle: 'Sprzęt',
    restore: restoreEquipmentAction,
    restored: 'Sprzęt przywrócony.',
    deleteForever: {
      action: deleteEquipmentForeverAction,
      lost: 'historia przekazań',
      nameLabel: 'Nazwa sprzętu',
      deleted: 'Sprzęt usunięty na zawsze.',
    },
  },
  lead: {
    sectionTitle: 'Zgłoszenia',
    restore: restoreLeadAction,
    restored: 'Zgłoszenie przywrócone.',
    deleteForever: {
      note: () => 'Inwestycja założona z tego zgłoszenia i jej pliki zostają bez zmian.',
      action: deleteLeadForeverAction,
      lost: 'dane kontaktowe, odpowiedzi z formularza i pliki, których nie ma w żadnej inwestycji',
      nameLabel: 'Nazwa zgłoszenia',
      deleted: 'Zgłoszenie usunięte na zawsze.',
    },
  },
  file: {
    sectionTitle: 'Pliki',
    restore: restoreDetachedFileAction,
    restored: 'Plik przywrócony.',
  },
}

export const TRASH_KIND_ORDER = Object.keys(TRASH_KINDS) as TrashKindT[]
