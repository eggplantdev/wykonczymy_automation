import { pl } from '@/lib/i18n/dictionaries/pl'
import { POLISH_GRID, type MessageKeyT, type TranslatorT } from '@/lib/i18n/translations'
import { basePriceKey } from '@/lib/kosztorys/plane-price-keys'
import {
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
} from '@/lib/kosztorys/stage-keys'

const DISCOUNT_IS_CLIENT_ONLY = 'Rabat nie obniża stawek robocizny dla ekip.'

// Read in every view, so a crew view has to say its base out loud: „Razem netto" beside it is at the
// crew's rate over the crew's etapy.
const CLIENT_BASE = 'Zawsze po cenie klienta, dla całego zakresu (wszystkie etapy).'

const REMAINING = `Wartość aktualizacji przedmiaru minus wartość pomiaru.\nIle z uzgodnionego zakresu nie zostało jeszcze wykonane.\nNa minusie (na czerwono) = przekroczono aktualizację przedmiaru; suma w stopce pomija takie wiersze.\n\n${CLIENT_BASE}`

const PLANNED = `Przedmiar ofertowy razy cena minus rabat — wartość oferty.\n\n${CLIENT_BASE}`

const CURRENT_PLANNED = `Aktualizacja przedmiaru razy cena minus rabat.\n\n${CLIENT_BASE}`

const HEADER_TIPS: Record<string, string> = {
  plannedQty: 'Przedmiar ofertowy — ilość z oferty.\nNa nim stoi wartość oferty i prognoza marży.',
  currentPlannedQty: pl.grid.tipCurrentPlannedQty,
  note: 'Naciśnij enter lub kliknij dwukrotnie aby otworzyć.\n\nShift+Enter — nowa linia\nEnter — zapisz i przejdź niżej\nEscape — cofnij zmiany\nTab — zakończ edycję',
  stageQtySum: pl.grid.tipStageQtySum,
  divergence:
    'Różnica między danymi zaciągiętymi z arkusza google a pracą rozpisaną na etapy \n Oznacza, że praca jest wpisana w arkuszu google jako pomiar z natury ale nie jest wpisana do etapów.',
  priceMode: 'Auto = domyślny mnożnik dla danej inwestycji.',
  priceCoeff:
    'Mnożnik liczony od ceny dla inwestora.\nStawka to cena j.m. razy mnożnik, więc podniesienie ceny przesuwa ją od razu — w odróżnieniu od wpisanej kwoty.',
  plannedNet: PLANNED,
  plannedGross: PLANNED,
  currentPlannedNet: CURRENT_PLANNED,
  currentPlannedGross: CURRENT_PLANNED,
  plannedNetForPlane: `Aktualizacja przedmiaru razy stawka tego rozliczenia.\nIle ekipa zarobi, jeśli wykona cały uzgodniony zakres.\n\n${DISCOUNT_IS_CLIENT_ONLY}`,
  net: `Pomiar razy cena minus rabat.\n\n${DISCOUNT_IS_CLIENT_ONLY}`,
  gross: `Pomiar razy cena minus rabat.\n\n${DISCOUNT_IS_CLIENT_ONLY}`,
  remaining: REMAINING,
  remainingGross: REMAINING,
  remainingForPlane: pl.grid.tipRemainingForPlane,
  plannedDonePercent: `Procent wykonania względem przedmiaru ofertowego.\nIle procent oferty jest zrobione.\nPowyżej 100% — wykonano więcej, niż zakładała oferta (np. po aktualizacji przedmiaru).\nKreska dla pozycji spoza oferty.\n\n${CLIENT_BASE}`,
  donePercent: `Procent wykonania względem aktualizacji przedmiaru.\nIle procent uzgodnionego zakresu jest zrobione.\nPowyżej 100% oznacza przekroczenie prognozy\n\n${CLIENT_BASE}`,
  [STAGE_VALUE_NET_COLUMN_GROUP]: `Ilość wykonana w tym etapie razy cena jednostki miary minus udział etapu w rabacie.\nUdział jest proporcjonalny do ilości (rabat zł jest rabatem od całego wiersza, więc etap niesie tylko swoją część).\nZależy od aktywnego widoku cen.\n\n${DISCOUNT_IS_CLIENT_ONLY}`,
  [STAGE_VALUE_GROSS_COLUMN_GROUP]: 'Etap — kwota brutto = Etap — kwota netto razy (1 + VAT).',
}

// The worker's document is read by the crew, whose figures are pomiar × their own stawka: the
// client's rabat and the editor's price view are not in them, so the tips above would misexplain it.
// Every tip his link shows is listed, because it is read in his language.
const WORKER_TIP_KEYS: Partial<Record<string, MessageKeyT<'grid'>>> = {
  plannedQty: 'tipPlannedQty',
  currentPlannedQty: 'tipCurrentPlannedQty',
  stageQtySum: 'tipStageQtySum',
  plannedNetForPlane: 'tipPlannedNetForPlane',
  net: 'tipNet',
  [STAGE_VALUE_NET_COLUMN_GROUP]: 'tipStageValueNet',
  remainingForPlane: 'tipRemainingForPlane',
  plannedDonePercent: 'tipPlannedDonePercent',
}

/**
 * The map's only reader, so the base-key resolution lives here rather than at a call site — same
 * shape as `columnLabelForView`, `axisAllows` and `layerAllows`, which each own it too. One tip on
 * „Cena j.m." has to answer for both planes' rate columns; a second entry per plane is the drift
 * `column-config.ts` exists to prevent.
 */
export function headerTipFor(
  columnId: string,
  {
    workerSurface = false,
    dictionary = POLISH_GRID,
  }: { workerSurface?: boolean; dictionary?: TranslatorT<'grid'> } = {},
): string | undefined {
  const key = basePriceKey(columnId)
  const workerKey = workerSurface ? WORKER_TIP_KEYS[key] : undefined
  return workerKey ? dictionary.t(workerKey) : HEADER_TIPS[key]
}
