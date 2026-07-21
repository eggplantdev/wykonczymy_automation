import {
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  STAGE_VALUE_PERCENT_COLUMN_GROUP,
  STAGES_COLUMN_GROUP,
} from '@/lib/kosztorys/stage-keys'

// Audit aid (may be temporary): each header explains the column's intent + the formula that
// drives it, so mismatches between intent and calc are visible.
export const HEADER_TIPS: Record<string, string> = {
  plannedQty: 'Przedmiar — ilość planowana',
  stageQtySum: 'Pomiar — ilość faktycznie wykonana.\nSuma ilości ze wszystkich etapów.',
  priceCoeff:
    '1 = tyle co Cena klienta \n 0.65 = 65% ceny klienta · 1.2 = 120% ceny klienta.\n\nSzary kursywą = dziedziczony (z sekcji lub domyślny z inwestycji). Wpisanie własnego przestawia wiersz na „własny mnożnik".\n„—" Kwota stała, mnożnik się nie stosuje',
  priceMode: 'Auto = mnożnik dziedziczony - domyślny z inwestycji lub ustawiony dla danej sekcji.',
  discountType:
    'Rabat — typ rabatu: — brak · % procent · zł kwota.\nUstawienie „Bez rabatu" czyści też Rabat wart.',
  discountAmount:
    'Rabat kwota netto — ile złotych faktycznie schodzi z tej pozycji (Pomiar × Cena j.m. − Netto).\nPrzy rabacie % przelicza punkty procentowe na złotówki; przy rabacie zł jest równy wpisanej kwocie.\nZależy od aktywnego widoku cen — ten sam rabat % daje inną kwotę przy cenie klienta i przy cenie wykonawcy.',
  plannedNet: 'Przedmiar × Cena − Rabat.',
  plannedGross: '(Przedmiar × Cena − Rabat) × (1 + VAT).',
  net: 'Pomiar × Cena − Rabat.',
  gross: '(Pomiar × Cena − Rabat) × (1 + VAT).',
  remaining:
    'Wartość przedmiaru − wartość netto pomiaru.\nIle z oferty nie zostało jeszcze wykonane.\nNa minusie = przekroczono przedmiar.\n„—" = pozycja nie ma przedmiaru.',
  remainingGross:
    'Wartość przedmiaru − wartość pomiaru, brutto = netto × (1 + VAT).\nIle z oferty nie zostało jeszcze wykonane.\nNa minusie = przekroczono przedmiar.\n„—" = pozycja nie ma przedmiaru.',
  donePercent:
    '% wykonania względem przedmiaru.\nIle procent oferty jest zrobione.\n„—" = brak przedmiaru. Powyżej 100% oznacza przekroczenie założeń z przedmiaru.',
  // The three stage axes key by column GROUP, not by column id — every stage's column shares its
  // axis's tip, because the only thing that differs between them is the stage's name.
  [STAGES_COLUMN_GROUP]:
    'Etap — ilość wykonana w tym etapie.\nWartość etapu = ilość × Cena − udział etapu w rabacie (proporcjonalny do ilości).',
  [STAGE_VALUE_NET_COLUMN_GROUP]:
    'Ilość wykonana w tym etapie × cena j.m. − udział etapu w rabacie.\nUdział jest proporcjonalny do ilości (rabat zł jest rabatem od całego wiersza, więc etap niesie tylko swoją część).\nZależy od aktywnego widoku cen.',
  [STAGE_VALUE_GROSS_COLUMN_GROUP]: 'Etap — kwota brutto = Etap — kwota netto × (1 + VAT).',
  [STAGE_VALUE_PERCENT_COLUMN_GROUP]:
    'Etap — % wykonania w tym etapie względem przedmiaru.\nIle z oferty dowiózł ten etap. \n„ —" = brak Przedmiaru.',
}
