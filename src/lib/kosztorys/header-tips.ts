import { basePriceKey } from '@/lib/kosztorys/plane-price-keys'
import {
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
} from '@/lib/kosztorys/stage-keys'

const DISCOUNT_IS_CLIENT_ONLY = 'Rabat nie obniża stawek robocizny dla ekip.'

// Read in every view, so a crew view has to say its base out loud: „Razem netto" beside it is at the
// crew's rate over the crew's etapy.
const CLIENT_BASE = 'Zawsze po cenie klienta, dla całego zakresu (wszystkie etapy).'

const REMAINING = `Wartość przedmiaru minus wartość pomiaru.\nIle z oferty nie zostało jeszcze wykonane.\nNa minusie = przekroczono przedmiar.\n\n${CLIENT_BASE}`

const PLANNED = `Przedmiar razy cena minus rabat.\n\n${CLIENT_BASE}`

const HEADER_TIPS: Record<string, string> = {
  plannedQty: 'Przedmiar — ilość planowana (prognoza zakresu z oferty).',
  note: 'Naciśnij enter lub kliknij dwukrotnie aby otworzyć.\n\nShift+Enter — nowa linia\nEnter — zapisz i przejdź niżej\nEscape — cofnij zmiany\nTab — zakończ edycję',
  stageQtySum: 'Pomiar — ilość faktycznie wykonana.\nSuma ilości prac w widocznych etapach.',
  divergence:
    'Różnica między danymi zaciągiętymi z arkusza google a pracą rozpisaną na etapy \n Oznacza, że praca jest wpisana w arkuszu google jako pomiar z natury ale nie jest wpisana do etapów.',
  priceMode: 'Auto = domyślny mnożnik dla danej inwestycji.',
  priceCoeff:
    'Mnożnik liczony od ceny dla inwestora.\nStawka to cena j.m. razy mnożnik, więc podniesienie ceny przesuwa ją od razu — w odróżnieniu od wpisanej kwoty.',
  plannedNet: PLANNED,
  plannedGross: PLANNED,
  net: `Pomiar razy cena minus rabat.\n\n${DISCOUNT_IS_CLIENT_ONLY}`,
  gross: `Pomiar razy cena minus rabat.\n\n${DISCOUNT_IS_CLIENT_ONLY}`,
  remaining: REMAINING,
  remainingGross: REMAINING,
  donePercent: `Procent wykonania względem przedmiaru.\nIle procent oferty jest zrobione.\nPowyżej 100% oznacza przekroczenie prognozy\n\n${CLIENT_BASE}`,
  [STAGE_VALUE_NET_COLUMN_GROUP]: `Ilość wykonana w tym etapie razy cena jednostki miary minus udział etapu w rabacie.\nUdział jest proporcjonalny do ilości (rabat zł jest rabatem od całego wiersza, więc etap niesie tylko swoją część).\nZależy od aktywnego widoku cen.\n\n${DISCOUNT_IS_CLIENT_ONLY}`,
  [STAGE_VALUE_GROSS_COLUMN_GROUP]: 'Etap — kwota brutto = Etap — kwota netto razy (1 + VAT).',
}

/**
 * The map's only reader, so the base-key resolution lives here rather than at a call site — same
 * shape as `columnLabelForView`, `axisAllows` and `layerAllows`, which each own it too. One tip on
 * „Cena j.m." has to answer for both planes' rate columns; a second entry per plane is the drift
 * `column-config.ts` exists to prevent.
 */
export function headerTipFor(columnId: string): string | undefined {
  return HEADER_TIPS[basePriceKey(columnId)]
}
