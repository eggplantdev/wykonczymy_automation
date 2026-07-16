import {
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  STAGE_VALUE_PERCENT_COLUMN_GROUP,
  STAGES_COLUMN_GROUP,
} from '@/lib/kosztorys/constants'

// Audit aid (may be temporary): each header explains the column's intent + the formula that
// drives it, so mismatches between intent and calc are visible.
export const HEADER_TIPS: Record<string, string> = {
  sectionName:
    'Sekcja — nazwa sekcji kosztorysu.\nEdycja tutaj zmienia nazwę całej sekcji (wartość jest zdenormalizowana na każdym wierszu). Zatwierdź Enterem lub wyjściem z pola, Escape cofa.',
  description: 'Opis — nazwa/opis pozycji robót lub materiału. Nie wchodzi do obliczeń.',
  unit: 'J.m. — jednostka miary (m², szt., mb…). Etykieta, nie wchodzi do obliczeń.',
  plannedQty:
    'Przedmiar — ilość planowana (z przedmiaru/oferty).\nNapędza Wartość przedmiaru (= Przedmiar × Cena − Rabat). Netto liczone jest z Pomiaru.',
  stageQtySum:
    'Pomiar — ilość faktycznie wykonana.\nTylko do odczytu: liczona automatycznie jako suma ilości ze wszystkich etapów. Napędza Netto = Pomiar × Cena − Rabat.',
  price:
    'Cena j.m. — cena jednostkowa przy aktywnym widoku cen (klient lub podwykonawca).\nW widokach wykonawcy edytowalna tylko przy „kwota stała" — w pozostałych trybach jest wyliczana (Cena klienta × Mnożnik).',
  priceCoeff:
    'Mnożnik — przez ile mnożona jest Cena klienta, by dać cenę wykonawcy.\n1 = tyle co Cena klienta · 0.65 = 65% ceny klienta · 1.2 = 120% ceny klienta.\n\nSzary kursywą = dziedziczony (z sekcji, a gdy nieustawiony — domyślny z inwestycji). Wpisanie własnego przestawia wiersz na „własny mnożnik".\n„—" przy „kwota stała": cena jest wpisana wprost, mnożnik się nie stosuje.',
  priceMode:
    'Źródło ceny wykonawcy — skąd bierze się mnożnik.\n\nAuto = mnożnik dziedziczony: z sekcji, a gdy nieustawiony — domyślny z inwestycji.\nWłasny mnożnik = mnożnik wpisany w tym wierszu.\nKwota stała = cena wpisana wprost, nie podąża za Ceną klienta.\n\nAuto i własny mnożnik liczą tak samo (Cena klienta × mnożnik) — różni je tylko pochodzenie mnożnika.',
  discountType:
    'Rabat — typ rabatu: — brak · % procent · zł kwota.\nUstawienie „Bez rabatu" czyści też Rabat wart.',
  discountValue:
    'Rabat wart. — wartość rabatu.\nDla % = punkty procentowe (10 = 10%); dla zł = kwota odjęta od Netto.\nWpisanie wartości przy „Bez rabatu" ustawia typ na %. Wyczyszczenie pola kasuje rabat.',
  discountAmount:
    'Rabat kwota netto — ile złotych faktycznie schodzi z tej pozycji (Pomiar × Cena j.m. − Netto).\nPrzy rabacie % przelicza punkty procentowe na złotówki; przy rabacie zł jest równy wpisanej kwocie.\nZależy od aktywnego widoku cen — ten sam rabat % daje inną kwotę przy cenie klienta i przy cenie wykonawcy.',
  discountAmountGross: 'Rabat kwota brutto = Rabat kwota netto × (1 + VAT).',
  priceGross:
    'Cena j.m. brutto = Cena j.m. netto × (1 + VAT).\nStawka VAT jest jedna na całą inwestycję — ta kolumna to przelicznik, nie osobna dana.',
  plannedNet:
    'Wartość przedmiaru netto = Przedmiar × Cena − Rabat. Wartość ofertowa pozycji — ile miało wejść wg przedmiaru.\nRabat jest w kwocie zawarty (jak w arkuszu). Różnica Netto − Wartość przedmiaru to sama korekta ilości: obie kwoty niosą już rabat.',
  plannedGross: 'Wartość przedmiaru brutto = Wartość przedmiaru netto × (1 + VAT).',
  net: 'Netto = Pomiar × Cena − Rabat. Wartość pozycji przy aktywnym widoku cen.\nPomiar jest sumą etapów, więc Netto mówi, ile faktycznie wykonano — pusta pozycja jest warta 0.',
  gross: 'Brutto = Netto × (1 + VAT). Jedna stawka VAT na inwestycję, zdenormalizowana na wierszu.',
  remaining:
    'Pozostało netto = Wartość netto przedmiar − Netto.\nIle z oferty nie zostało jeszcze wykonane. Pusty wiersz etapów = cała oferta zostaje.\nNa minusie = zrobiono więcej, niż przewidywał Przedmiar. „—" = pozycja nie ma Przedmiaru, więc nie ma oferty, od której odejmować.',
  remainingGross: 'Pozostało brutto = Pozostało netto × (1 + VAT).',
  donePercent:
    '% wykonania = suma ilości ze wszystkich etapów ÷ Przedmiar.\nIle procent oferty jest zrobione. Nie zależy od widoku cen ani od netto/brutto — to stosunek ilości, cena i rabat go nie ruszają.\n„—" = brak Przedmiaru, więc nie ma czego dzielić (to nie to samo co 0%). Powyżej 100% = zrobiono więcej, niż przewidywał Przedmiar; wartość nie jest przycinana, bo to jest ta informacja.\nNa czerwono = to samo przekroczenie, widoczne z daleka.',
  // The three stage axes key by column GROUP, not by column id — every stage's column shares its
  // axis's tip, because the only thing that differs between them is the stage's name.
  [STAGES_COLUMN_GROUP]:
    'Etap — ilość wykonana w tym etapie (wpisywana w wierszu).\nWartość etapu = ilość × Cena − udział etapu w rabacie (proporcjonalny do ilości). Suma ukończonych etapów pomniejsza kolumnę Pozostało.',
  [STAGE_VALUE_NET_COLUMN_GROUP]:
    'Etap — kwota netto = ilość wykonana w tym etapie × Cena j.m. − udział etapu w rabacie.\nUdział jest proporcjonalny do ilości (rabat zł jest rabatem od całego wiersza, więc etap niesie tylko swoją część). Kwoty wszystkich etapów sumują się do Netto pozycji.\nZależy od aktywnego widoku cen.',
  [STAGE_VALUE_GROSS_COLUMN_GROUP]: 'Etap — kwota brutto = Etap — kwota netto × (1 + VAT).',
  [STAGE_VALUE_PERCENT_COLUMN_GROUP]:
    'Etap — % wykonania = ilość wykonana w tym etapie ÷ Przedmiar.\nIle z oferty dowiózł ten etap. Ta sama liczba przy każdym widoku cen i po obu stronach netto/brutto — to stosunek ilości. Kolumny procentowe etapów sumują się do kolumny „% wykonania".\n„—" = brak Przedmiaru.',
}
