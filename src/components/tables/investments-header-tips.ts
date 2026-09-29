// Formula tips for the investments listing headers, mirroring the kosztorys grid's `HEADER_TIPS` —
// same register: operators spelled out, one thought per line. Each money column says out loud which
// terms it adds and where they come from, because the same noun („robocizna", „rabat") names a
// different number on each plane and the listing shows both.
const FROM_TRANSACTIONS = 'Robocizna i rabat z transferów (v1).'
const FROM_KOSZTORYS = 'Robocizna i rabat z kosztorysu (v2).\nBez kosztorysu — „brak danych".'

// Wpłaty, materiały, wypłaty, strata i wydatki rozliczone są transakcyjne na OBU planach, więc
// bilans i marża różnią się między v1 a v2 wyłącznie parą robocizna/rabat.
const BALANCE =
  'Wpłaty minus materiały minus robocizna plus rabat plus obniżka materiałów plus strata.\nNa minusie = inwestor jest winien firmie.'

export const INVESTMENT_HEADER_TIPS: Record<string, string> = {
  balanceFromTransactions: `${BALANCE}\n${FROM_TRANSACTIONS}`,
  balance: `${BALANCE}\n${FROM_KOSZTORYS}\nLiczony w trybie netto i mieszanym — w brutto rachunek jest brutto, więc tu widnieje „nie dotyczy".`,
  balanceGross: `Ten sam bilans w brutto.\n${FROM_KOSZTORYS}\nLiczony tylko w trybie brutto: gdzie indziej część wpłat przychodzi gotówką i nie ma kwoty brutto, więc bilans brutto zaniżałby to, co klient wpłacił.`,
  margin: `Robocizna minus wypłaty minus rabat minus strata minus wydatki wliczone w robociznę minus obniżka materiałów.\n${FROM_TRANSACTIONS}`,
  marginV2: `Robocizna minus rabat minus należne ekipom minus wydatki wliczone w robociznę minus strata.\n${FROM_KOSZTORYS}\nZamiast wypłat wchodzi to, co ekipom się NALEŻY za rozpisane etapy — ekipa zapłacona z opóźnieniem czytałaby się jako zysk.\nObniżki materiałów tu nie ma — to ustępstwo na przelotowym koszcie, nie na wykonanej pracy.\n„ustaw etapy" = któryś etap ma pracę bez rozliczenia, więc kwota jest nieznana, a nie zerowa.`,
  laborCostsFromTransactions:
    'Suma transferów typu „Robocizna", przed rabatem.\nTu zostaje robocizna zaksięgowana transferami, dopóki ta praca nie trafi do kosztorysu.',
  laborCostsFromKosztorys:
    'Suma wartości prac wykonanych w kosztorysie, w cenie dla inwestora, przed rabatem.\nKosztorys jest jedynym źródłem — bez niego „brak danych", a nie odczyt z transferów.',
  totalInvestmentExpense:
    'Materiały, którymi obciążany jest inwestor: paragon brutto podzielony przez (1 plus stawka netto materiałów).\nBez zapisanej stawki — sam paragon, bez przeliczania.',
  totalSettled:
    'Suma wydatków oznaczonych „rozliczone".\nFirma je kupiła, ale są już w cenie robocizny — obniżają marżę i nie wchodzą do bilansu.',
  totalPayouts: 'Suma transferów typu „Wypłata" — gotówka faktycznie wypłacona ekipom.',
  subcontractorRemaining:
    'Należne ekipom za wykonane etapy minus suma transferów typu „Wypłata".\nNależne liczone z kosztorysu przed rabatem, każdy etap w cenie swojego rozliczenia — ta sama kwota co w podsumowaniu kosztorysu, zakładka „Podwykonawcy".\nNa minusie = ekipy dostały więcej, niż wykonały.\n„ustaw etapy" = któryś etap ma pracę bez rozliczenia, więc należne są zaniżone o nieznaną kwotę.\nBez kosztorysu — „brak danych".',
}
