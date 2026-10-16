import { CONTRACTOR } from '@/lib/investments/contract/constants'
import type { ContractSectionT } from '@/lib/investments/contract/types'

// Transcribed from context/reference/umowa/umowa-wykonczeniowa.pdf, typos fixed only.
export const CONTRACT_SECTIONS: ContractSectionT[] = [
  {
    title: '§ 1. PRZEDMIOT UMOWY',
    points: [
      {
        text: 'Zamawiający zamawia, a Przyjmujący zamówienie przyjmuje do wykonania – zgodnie z kosztorysem i projektem architektonicznym, stanowiącymi załączniki nr 1 i 2 do niniejszej Umowy – prace wykończeniowo-budowlane w mieszkaniu/domu opisanym w § 1 ust. 2 Umowy.',
      },
      {
        text: 'Dom/mieszkanie, w którym będą prowadzone prace wykończeniowo-budowlane, zlokalizowany jest: {siteAddress}.',
      },
      {
        text: 'Przyjmujący zamówienie oświadcza, że posiada niezbędne umiejętności, wiedzę, środki, sprzęt i doświadczenie do wykonania prac będących przedmiotem umowy i zobowiązuje się je wykonać z należytą starannością oraz zgodnie z aktualnym poziomem wiedzy i techniki oraz że ponosi pełną odpowiedzialność z tego tytułu.',
      },
      {
        text: 'Przyjmującemu zamówienie przysługuje prawo do zlecenia wykonania części lub całości prac stanowiących Przedmiot Umowy podwykonawcom pod warunkiem uprzedniego poinformowania Zamawiającego o takim zamiarze oraz o osobie podwykonawcy/ów.',
      },
      {
        text: 'W razie zlecenia przez Przyjmującego zamówienie części / całości prac stanowiących Przedmiot Umowy podwykonawcy / podwykonawcom, ponosi on odpowiedzialność za ich działania jak za działania własne.',
      },
      {
        text: 'Zamawiający nie ponosi odpowiedzialności za żadne zobowiązania Przyjmującego zamówienie względem podwykonawcy / podwykonawców, w szczególności nie ponosi on odpowiedzialności za zapłatę wynagrodzenia na jego / ich rzecz.',
      },
    ],
  },
  {
    title: '§ 2. TERMIN I SPOSÓB WYKONANIA UMOWY',
    points: [
      {
        text: 'Strony zgodnie postanawiają, że termin rozpoczęcia prac nastąpi pomiędzy {startWindow} a prace będą trwały {duration}. Termin ten może ulec wydłużeniu w przypadku pojawienia się dodatkowych prac, które nie były wcześniej przewidziane. Strony, w razie zwiększenia lub zmniejszenia zakresu dokonanych prac, mogą w drodze mailowej lub na piśmie ustalić nowy zakres prac oraz termin ich wykonania.',
      },
      {
        text: 'Przyjmujący zamówienie oświadcza, że posiada niezbędne umiejętności, wiedzę, środki, sprzęt i doświadczenie do wykonania prac będących przedmiotem umowy i zobowiązuje się je wykonać z należytą starannością oraz zgodnie z aktualnym poziomem wiedzy i techniki oraz że Przyjmujący zamówienie ponosi pełną odpowiedzialność za nienależyte wykonanie zleconych prac będących przedmiotem Umowy.',
      },
      {
        text: 'Osoby odpowiedzialne za nadzór oraz prawidłowe wykonanie Umowy ze strony Przyjmującego zamówienie: {supervisors}. W przypadku przekazania nadzoru innej osobie Przyjmujący zamówienie poinformuje w drodze pisemnej o nowej osobie odpowiedzialnej za projekt.',
      },
      {
        text: 'Rezerwacja terminu następuje poprzez wpłatę zadatku w wysokości 10% wartości umowy, który będzie rozliczony przy pierwszym rozliczeniu.',
      },
      {
        text: `Wpłaty należy dokonać w ciągu 7 dni od daty podpisania umowy przelewem na konto ${CONTRACTOR.bankAccount}.`,
      },
    ],
  },
  {
    title: '§ 3. WYNAGRODZENIE, ROZLICZENIA',
    points: [
      {
        text: 'Za prawidłowe i zgodne z umową wykonanie przedmiotu Umowy w całości, a także wykonanie dodatkowych określonych w niniejszej Umowie obowiązków Przyjmującego zamówienie, Zamawiający zapłaci Przyjmującemu zamówienie wynagrodzenie rozliczone na podstawie kosztorysu prac w kwocie netto około {plannedNet} zł 8% VAT (Mieszkania do 150 m²/Domy do 300 m²).',
      },
      {
        text: 'Strony, w razie zwiększenia lub zmniejszenia zakresu dokonanych prac, mogą w drodze mailowej/elektronicznej ustalić zwiększenie lub zmniejszenie wysokości wskazanego wynagrodzenia.',
      },
      {
        text: 'Wynagrodzenie będzie wypłacane co dwa tygodnie w częściach za wykonanie kolejnych etapów prac.',
      },
      {
        text: 'Kosztorys oparty jest na podstawie przedmiaru robót na początku uzgadniania zakresu prac. Po wykonaniu danych czynności zostanie wykonany pomiar z natury.',
      },
      {
        text: 'Materiały budowlane dostarczone przez Przyjmującego zamówienie rozliczane będą gotówką na podstawie dowodów zakupu przy okazji rozliczenia poszczególnych etapów prac.',
      },
    ],
  },
  {
    title: '§ 4. PRAWA I OBOWIĄZKI STRON',
    points: [
      {
        text: 'Obowiązki Zamawiającego:',
        subpoints: [
          'Zamawiający udostępni Dom Przyjmującemu zamówienie najpóźniej w dniu rozpoczęcia prac;',
          'Zamawiający zobowiązuje się do udostępnienia Przyjmującemu zamówienie Domu lub jego części, w której mają być wykonywane umówione prace, na czas trwania Umowy;',
          'Zamawiający udostępnia bez naliczania opłat dostęp do ujęcia wody, prądu i światła, przy czym nie ponosi on odpowiedzialności za przerwy w dostawach niezależne od niego;',
          'Zamawiający zapewni dostarczenie glazury, armatury i elementów wyposażenia łazienek oraz innych niezbędnych elementów wykończeniowych i wyposażenia, takich jak: lampy, farby, podłogi, drzwi, fugi etc.;',
          'Zamawiający odpowiada za przydatność materiałów i elementów wykończeniowych oraz elementów wyposażenia, które to on dostarczył;',
          'Zamawiający zobowiązany jest do terminowej zapłaty za kolejne etapy wykonanych prac oraz za materiały dostarczone przez Przyjmującego zamówienie;',
          'Zamawiający odpowiada za terminowe dostarczenie wszelkich materiałów i elementów wyposażenia / wykończeniowych, o których mowa w pkt 4 powyżej, które są niezbędne do wykonywania przez Przyjmującego zamówienie kolejnych etapów prac.',
        ],
      },
      {
        text: 'Obowiązki Przyjmującego zamówienie:',
        subpoints: [
          'Przyjmujący zamówienie wykonuje prace zgodnie z kosztorysem prac, dokumentacją stanowiącą załącznik nr 1 / 2 do umowy oraz inną dokumentacją przekazaną przez Zamawiającego, w tym dokumentacją techniczną;',
          'Przyjmujący zamówienie zamówi w imieniu Zamawiającego niezbędną ilość kontenerów lub gruzbagów do usunięcia powstałych w trakcie prac odpadów;',
          'Przyjmujący zamówienie dostarczy na miejsce prac wykończeniowych wszelkie niezbędne materiały budowlane, takie jak bloczki, cement, kleje, przy czym materiały budowlane dostarczone przez Przyjmującego zamówienie rozliczane będą gotówką przy okazji rozliczenia poszczególnych etapów prac przez Zamawiającego na podstawie przedstawionych rachunków i faktur dostarczonych przez Przyjmującego zamówienie;',
          'Przyjmujący zamówienie odpowiada za jakość i przydatność do użycia wszelkich materiałów, które to on dostarczył, oraz ma obowiązek kontroli jakości materiałów użytych do wykonania prac wykończeniowo-budowlanych;',
          'Przyjmujący zamówienie potwierdza przy odbiorze materiału i elementów wyposażenia oraz elementów wykończeniowych od Zamawiającego ich przydatność do wbudowania, przy czym w razie zgłoszenia przez niego zastrzeżeń Zamawiającemu nie odpowiada za ich wykorzystanie mimo zastrzeżeń;',
          'Przyjmujący zamówienie przekaże Zamawiającemu wszelkie niewykorzystane materiały budowlane pozostałe po wykonaniu robót, chyba że Zamawiający zażyczy sobie ich utylizacji;',
          'Przyjmujący zamówienie jest odpowiedzialny za utrzymanie porządku i czystości w obiekcie lub jego części, w której będą wykonywane prace wykończeniowo-budowlane, oraz za usuwanie po zakończeniu robót wszelkich instalacji tymczasowych, a także pozostawienie obiektu sprzątniętego z gruzu, zanieczyszczeń itp.;',
          'Przyjmujący zamówienie nadzoruje pracę pracowników i podwykonawców, w tym pod kątem przestrzegania obowiązujących norm i przepisów (w tym BHP);',
          'Przyjmujący zamówienie jest zobowiązany posiadać ubezpieczenie OC w kwocie min. 500 000 zł w trakcie całego okresu pracy.',
        ],
      },
    ],
  },
  {
    title: '§ 5. ODSTĄPIENIE OD UMOWY / KARY UMOWNE',
    points: [
      {
        text: 'Zamawiającemu przysługuje prawo odstąpienia od Umowy, jeżeli Przyjmujący zamówienie:',
        subpoints: [
          'nie przystąpi do rozpoczęcia prac bez uzasadnionej przyczyny w terminie 7 dni od umówionej daty wskazanej w § 2 ust. 1;',
          'nie kontynuuje wykonywania prac przez okres 3 dni pomimo wezwania przez Zamawiającego;',
          'przekroczył termin zakończenia prac, o którym mowa w § 2 ust. 1 (z zastrzeżeniem możliwości jego zmiany przewidzianej w tym ustępie), o co najmniej 14 dni;',
          'wykonuje prace w sposób sprzeczny z Umową i / lub projektem lub w sposób sprzeczny ze sztuką budowlaną lub obowiązującymi przepisami i nie zaprzestaje / nie dokonuje niezbędnych poprawek w terminie 3 dni od wezwania przez Zamawiającego.',
        ],
      },
      {
        text: 'Przyjmującemu zamówienie przysługuje prawo odstąpienia od Umowy lub wstrzymania prac, jeżeli Zamawiający:',
        subpoints: [
          'nie wywiązuje się z obowiązku zapłaty za kolejne etapy prac w terminie dłuższym niż 5 dni;',
          'opóźnia się z obowiązkiem zapłaty za materiały (§ 4 ust. 2 pkt 3 Umowy) o co najmniej 5 dni;',
          'nie wywiązuje się z obowiązku udostępnienia Domu Przyjmującemu zamówienie przez okres dłuższy niż 5 dni pomimo wezwania go do udostępnienia Domu zgodnie z Umową.',
        ],
      },
      {
        text: 'Oświadczenie o odstąpieniu od Umowy powinno zostać złożone drugiej Stronie w formie pisemnej pod rygorem nieważności.',
      },
      {
        text: 'W razie odstąpienia od Umowy przez którąkolwiek ze Stron z przyczyn leżących po stronie Przyjmującego zamówienie, zobowiązuje się on do zapłaty kary umownej na rzecz Zamawiającego w wysokości 10% wynagrodzenia umownego brutto wskazanego w § 3 ust. 1 Umowy.',
      },
      {
        text: 'W razie odstąpienia od Umowy przez którąkolwiek ze Stron z przyczyn leżących po stronie Zamawiającego, zobowiązuje się on do zapłaty kary umownej na rzecz Przyjmującego zamówienie w wysokości 10% wynagrodzenia umownego brutto wskazanego w § 3 ust. 1 Umowy.',
      },
    ],
  },
  {
    title: '§ 6. ODBIÓR TECHNICZNY PRAC',
    points: [
      {
        text: 'Strony ustalają, że informacja o odbiorze prac będzie przekazana z trzydniowym wyprzedzeniem, a odbiór techniczny będzie przeprowadzony zgodnie z normami oraz przepisami prawa budowlanego.',
      },
      {
        text: 'Odbiór prac powinien być dokonywany według norm prawa budowlanego. Dodatkowe wymagania dotyczące jakości powierzchni ścian i sufitu powinny być uwzględnione w specyfikacji odbioru robót.',
      },
      {
        text: 'Zamawiający uprawniony jest do odmowy dokonania odbioru, jeżeli roboty zostaną wykonane wadliwie lub wady wyłączają lub zmniejszają możliwość użytkowania Domu. Odbiór nastąpi wówczas po usunięciu wad, przy czym etapy robót będą na bieżąco odbierane przez Zamawiającego.',
      },
      {
        text: 'Wszelkie inne odbiory prac, niewymienione w niniejszym paragrafie, regulują obowiązujące normy budowlane.',
      },
    ],
  },
  {
    title: '§ 7. GWARANCJA, WADY, USTERKI I SERWISY',
    points: [
      {
        text: 'Zamawiający ma 14 dni od czasu powzięcia informacji o zaistniałej wadzie i / lub usterce na zgłoszenie tego faktu Przyjmującemu zamówienie. Wszelkie reklamacje należy składać w formie telefonicznej lub mailowej, z opisem wady i / lub usterki oraz (jeżeli jest to możliwe) ze zdjęciami. Powyższa forma zgłoszenia pozwoli Przyjmującemu zamówienie na niezwłoczne podjęcie stosownych działań.',
      },
      {
        text: 'Po dokonaniu zgłoszenia Strony wspólnie ustalą termin usunięcia wady i / lub usterki, który nie będzie dłuższy niż 14 dni.',
      },
      {
        text: 'Usunięcie wad i / lub usterek następuje na koszt Przyjmującego zamówienie.',
      },
      {
        text: 'W przypadku zgłoszenia wady i / lub usterki, za które odpowiedzialności nie ponosi Przyjmujący zamówienie, Zamawiający zostanie obciążony kwotą 300,00 zł za sam przyjazd serwisanta, a w sytuacji wymagającej podjęcia prac i / lub napraw i ich zlecenia Przyjmującemu zamówienie Strony dokonają ewentualnych ustaleń co do wzajemnych rozliczeń.',
      },
      {
        text: 'Gwarancja na wykonane prace wynosi 36 miesięcy.',
      },
    ],
  },
  {
    title: '§ 8. POSTANOWIENIA KOŃCOWE',
    points: [
      {
        text: 'Wszelkie zmiany niniejszej Umowy wymagają zachowania formy pisemnego aneksu podpisanego przez obie Strony pod rygorem nieważności, chyba że w treści Umowy przewidziano dopuszczalność innej formy.',
      },
      {
        text: 'Wszelkie pisma wysłane na adresy Stron wskazane w Umowie (lub nowe adresy wskazane na piśmie przez Stronę drugiej Stronie w trakcie trwania Umowy) uznaje się za doręczone z upływem okresów awizowania.',
      },
      {
        text: 'Umowa zastępuje wszelkie wcześniejsze ustalenia Stron poczynione ustnie lub w drodze korespondencji.',
      },
      {
        text: 'W sprawach nieuregulowanych niniejszą Umową mają zastosowanie obowiązujące przepisy, w szczególności przepisy Kodeksu cywilnego.',
      },
      {
        text: 'Niniejszą Umowę sporządzono w dwóch egzemplarzach, w języku polskim, po jednym dla każdej ze Stron.',
      },
    ],
  },
]
