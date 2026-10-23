import { Panel } from '@/components/ui/panel'
import { Description } from '@/components/ui/description'
import { SectionHeader, EYEBROW_CLASS } from '@/components/ui/section-header'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { AI_ACCURACY_WINDOW, type AiAccuracyT } from '@/lib/kosztorys/ai-accuracy'
import { formatPLN } from '@/lib/utils/format-currency'
import { AccuracyCasesTable } from './accuracy-cases-table'
import { AccuracyRepeatGroupsTable } from './accuracy-repeat-groups-table'
import { AccuracyRepeatsTable } from './accuracy-repeats-table'
import { AccuracySplitTable } from './accuracy-split-table'
import { AccuracyTile } from './accuracy-tile'
import { AiAccuracyChart } from './ai-accuracy-chart'
import { formatWholePercent } from './format'

const SUM_COLS = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`
const PROSE_CLASS = 'max-w-prose text-sm leading-relaxed'
const TILES_CLASS = 'grid gap-4 sm:grid-cols-3'

type PropsT = {
  accuracy: AiAccuracyT
  excludedNames: string[]
}

export function AiAccuracyReport({ accuracy, excludedNames }: PropsT) {
  const { windows, example, cases } = accuracy
  const lastCount = windows.last.labels.length

  return (
    <div className="grid max-w-5xl gap-10">
      <p className={`text-muted-foreground ${PROSE_CLASS}`}>
        AI czyta to, co przysłał klient (rzuty, zdjęcia, maila), i wpisuje Przedmiar. Potem
        właściciel go sprawdza i poprawia złe liczby. Porównujemy liczby AI z ostatecznymi liczbami
        właściciela, przeliczone na złotówki po Cenie j.m. Strona liczy się na bieżąco: każda
        recenzja i każda poprawka w kosztorysie widać przy następnym wejściu.
      </p>

      <section className="grid gap-4">
        <SectionHeader title="Krótko" />
        <div className={TILES_CLASS}>
          <AccuracyTile
            label={`Wszystkie sprawdzone przypadki (${cases.length})`}
            value={formatWholePercent(windows.all.rightPercent)}
            caption="kosztorysu AI miało dobrze"
          />
          <AccuracyTile
            label={`Ostatnie ${lastCount} przypadków`}
            value={formatWholePercent(windows.last.rightPercent)}
            caption="kosztorysu AI miało dobrze"
          />
          <AccuracyTile
            label={`Najnowszy przypadek (${windows.latest.labels[0]})`}
            value={formatWholePercent(windows.latest.rightPercent)}
            caption="kosztorysu AI miało dobrze"
          />
        </div>
        <p className={PROSE_CLASS}>
          W ostatnich {lastCount} przypadkach na każde 100 zł w kosztorysie AI myli się o około{' '}
          <b>{formatPLN(windows.last.wrongPer100)}</b>, które właściciel musi poprawić. Niżej: skąd
          biorą się błędy i co z tym zrobić.
        </p>
      </section>

      {example && (
        <section className="grid gap-4">
          <SectionHeader title="Jak liczymy wynik, na jednym prawdziwym przykładzie" />
          <p className={PROSE_CLASS}>
            Pierwszy sprawdzony przypadek to {example.label}. Kosztorys ma wiele pozycji (gładź,
            płytki, punkty elektryczne…). W części pozycji AI wpisało za dużo, w części za mało.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Panel className="grid content-start gap-3 p-4">
              <span className={EYEBROW_CLASS}>Sposób 1: porównujemy tylko cenę końcową</span>
              <SummaryTable cols={SUM_COLS}>
                <SummaryCell>Kosztorys właściciela</SummaryCell>
                <SummaryCell className="text-right">{formatPLN(example.ownerZl)}</SummaryCell>
                <SummaryCell>Kosztorys AI</SummaryCell>
                <SummaryCell className="text-right">{formatPLN(example.aiZl)}</SummaryCell>
                <SummaryCell weight="medium">Różnica</SummaryCell>
                <SummaryCell className="text-right" weight="medium">
                  {formatPLN(example.priceGapZl)}
                </SummaryCell>
              </SummaryTable>
              <AccuracyTile
                value={formatWholePercent(example.priceMatchPercent)}
                caption="zgodności. Wygląda prawie idealnie… ale nie jest."
                tone="success"
              />
            </Panel>
            <Panel className="grid content-start gap-3 p-4">
              <span className={EYEBROW_CLASS}>
                Sposób 2: sumujemy każdy błąd, pozycja po pozycji
              </span>
              <SummaryTable cols={SUM_COLS}>
                <SummaryCell>Pozycje, gdzie AI dało za dużo</SummaryCell>
                <SummaryCell className="text-right">{formatPLN(example.tooHighZl)}</SummaryCell>
                <SummaryCell>Pozycje, gdzie AI dało za mało</SummaryCell>
                <SummaryCell className="text-right">{formatPLN(example.tooLowZl)}</SummaryCell>
                <SummaryCell weight="medium">Wszystkie błędy razem</SummaryCell>
                <SummaryCell className="text-right" weight="medium">
                  {formatPLN(example.wrongZl)}
                </SummaryCell>
              </SummaryTable>
              <AccuracyTile
                value={formatWholePercent(example.rightPercent)}
                caption="dobrze. To jest prawdziwy obraz."
                tone="error"
              />
            </Panel>
          </div>
          <p className={PROSE_CLASS}>
            <b>Skąd ta różnica:</b> w sposobie 1 „za dużo” i „za mało” się znoszą, więc cena końcowa
            wygląda dobrze, choć większość pozycji jest zła. To jak dwa paragony na 200 zł: jeden za
            chleb i mleko, drugi za piwo i chipsy. Ta sama suma, zupełnie inne zakupy.{' '}
            <b>Dlatego zawsze liczymy sposobem 2.</b>
          </p>
        </section>
      )}

      <section className="grid gap-4">
        <SectionHeader title="Wynik w czasie" />
        <Panel className="grid gap-3 p-4">
          <Description size="xs">
            Każdy słupek to jeden przypadek, w kolejności dodania inwestycji: jaką część kosztorysu
            AI miało dobrze (sposób 2). Linia to średnia z {AI_ACCURACY_WINDOW} ostatnich
            przypadków, żeby pojedynczy zły przypadek nie zasłaniał trendu. Najedź na słupek, żeby
            zobaczyć, która to inwestycja.
          </Description>
          <AiAccuracyChart cases={cases} />
        </Panel>
      </section>

      <section className="grid gap-4">
        <SectionHeader title="Skąd biorą się błędy" />
        <p className={PROSE_CLASS}>
          AI uczy się tylko z tego, co mu zapiszemy: z zasad w Manualu i z Powodów zmiany, które
          właściciel wpisuje przy poprawkach. Poprawiona liczba bez powodu to dla AI tylko inna
          liczba. Nie wie, czy klient tego nie chciał, czy rzut pokazywał mniej, czy właściciel
          celowo zaniżył ofertę. Więc następnym razem robi ten sam błąd.
        </p>

        <Panel className="grid gap-3 p-4">
          <span className={EYEBROW_CLASS}>Powód 1</span>
          <SectionHeader
            size="sm"
            title="Większość poprawek nie ma Powodu zmiany, więc AI nie ma się z czego uczyć"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <AccuracyTile
              value={formatWholePercent(windows.all.noReasonPercent)}
              caption="złotówek błędu we wszystkich przypadkach siedzi w pozycjach poprawionych bez powodu"
              tone="error"
            />
            <AccuracyTile
              value={formatWholePercent(windows.last.noReasonPercent)}
              caption={`w ostatnich ${lastCount} przypadkach`}
              tone="error"
            />
          </div>
          <Description size="xs">
            W pierwszych przypadkach nikt jeszcze nie wpisywał powodów, stąd tam 100%. Udział dla
            każdej inwestycji: tabela na dole strony.
          </Description>
        </Panel>

        <Panel className="grid gap-3 p-4">
          <span className={EYEBROW_CLASS}>Powód 2</span>
          <SectionHeader size="sm" title="AI powtarza te same błędy w kolejnych przypadkach" />
          <p className={PROSE_CLASS}>
            We wszystkich sprawdzonych przypadkach aż{' '}
            <b>{formatWholePercent(accuracy.repeatedSharePercent)}</b> złotówek błędu dotyczy
            pozycji, które AI pomyliło w co najmniej dwóch przypadkach. To nie są przypadkowe
            wpadki, tylko stałe nawyki. Jedna zasada w Manualu naprawiłaby je wszędzie naraz. Mimo
            to powód wpisywano przy nich rzadko, więc nikt tej zasady nie napisał.
          </p>
          <AccuracyRepeatGroupsTable groups={accuracy.repeatGroups} />
          <SectionHeader size="sm" title="Pozycje, które AI myli najczęściej" />
          <AccuracyRepeatsTable repeats={accuracy.repeats} />
        </Panel>

        <Panel className="grid gap-3 p-4">
          <span className={EYEBROW_CLASS}>Powód 3</span>
          <SectionHeader size="sm" title="AI często dodaje pozycje, które właściciel wyrzuca" />
          <p className={PROSE_CLASS}>
            Błąd może być trojaki: AI pominęło pozycję, którą właściciel dodał; AI dodało pozycję,
            którą właściciel wyrzucił (ustawił na 0); albo obaj ją mają, tylko z inną ilością. W
            ostatnich {lastCount} przypadkach drugi rodzaj to{' '}
            <b>{formatPLN(windows.last.extraZl)}</b> z <b>{formatPLN(windows.last.splitZl)}</b> (
            <b>{formatWholePercent(windows.last.extraPercent)}</b>). Czyli AI „na wszelki wypadek”
            dorzuca prace, o które klient nie prosił albo których właściciel w pierwszej ofercie nie
            daje. Tego nie da się odgadnąć z rzutu, trzeba to AI powiedzieć.
          </p>
          <AccuracySplitTable
            rows={[
              { label: `Wszystkie (${cases.length})`, window: windows.all },
              { label: `Ostatnie ${lastCount}`, window: windows.last },
            ]}
          />
        </Panel>

        <Panel className="grid gap-3 p-4">
          <span className={EYEBROW_CLASS}>Powód 4</span>
          <SectionHeader size="sm" title="Celowe zaniżanie wygląda jak błąd AI" />
          <p className={PROSE_CLASS}>
            Właściciel czasem specjalnie zaniża Przedmiar w pierwszej ofercie, żeby nie wystraszyć
            klienta, a resztę dolicza po wykonaniu. Gdy to zapisze w Powodzie zmiany, nie liczymy
            tego jako błąd AI. Ale zwykle nic nie wpisuje. Wtedy AI widzi tylko „za dużo” i uczy się
            zaniżać tam, gdzie liczyło dobrze, a my liczymy mu za to karę w wyniku.
          </p>
        </Panel>
      </section>

      <section className="grid gap-4">
        <SectionHeader title="Co z tym zrobić" />
        <ol className={`list-decimal space-y-2 pl-5 ${PROSE_CLASS}`}>
          <li>
            <b>Powód zmiany przy każdej poprawce.</b> Wystarczy krótko: „klient nie chce”, „z rzutu
            wychodzi mniej”, „u nas zawsze 2 warstwy”. Przy celowym zaniżeniu zawsze ten sam
            dopisek: <b>„celowo zaniżam”</b>. Bez tego żadna z pozostałych rzeczy nie zadziała.
          </li>
          <li>
            <b>Najpierw zasady dla pozycji, które się powtarzają.</b> Właściciel siada raz na pół
            godziny i dla każdej pozycji z tabeli wyżej mówi jedną zasadę: kiedy ją dajemy, kiedy
            nie i jak liczymy ilość (np. „gruntowanie tylko na świeże gładzie”, „punkty wod-kan
            liczymy z rzutu, nie na oko”). Te zasady trafiają do Manualu. To najtańszy sposób, żeby
            zbić największą część błędu.
          </li>
          <li>
            <b>Przejrzeć pozycje, które AI dodaje, a właściciel wyrzuca.</b> Spisać, czego nie
            dajemy w pierwszej ofercie, jeśli klient o to nie prosił, i wpisać to jako zasadę „nie
            dodawaj, chyba że…”.
          </li>
          <li>
            <b>Wynik po każdym przypadku.</b> Ta strona pokazuje go od razu po recenzji. Jeśli
            zmiana w sposobie pracy AI nie podniosła średniej z ostatnich przypadków, nie dokładamy
            kolejnej, tylko wracamy do punktów 1–3.
          </li>
          <li>
            <b>Co jakiś czas jeden przypadek „na ślepo”.</b> Właściciel wycenia sam, zanim zobaczy
            wersję AI, potem porównujemy. Tylko tak wiemy, czy wynik nie jest zawyżony przez to, że
            właściciel zaczyna od liczb AI.
          </li>
        </ol>
      </section>

      <section className="grid gap-4">
        <SectionHeader title="Dlaczego wynik nie jest dokładny" />
        <ul className={`list-disc space-y-2 pl-5 ${PROSE_CLASS}`}>
          <li>
            <b>Celowe zaniżenia bez opisu</b> liczymy jako błąd AI.{' '}
            <span className="text-muted-foreground">Prawdziwy wynik: trochę wyższy.</span>
          </li>
          <li>
            <b>Właściciel widział liczby AI przed swoją wyceną</b> (we wszystkich przypadkach poza
            pierwszymi dwoma). Jeśli przyjął liczbę AI bez sprawdzenia, liczy się ona jako dobra.{' '}
            <span className="text-muted-foreground">Prawdziwy wynik: trochę niższy.</span>
          </li>
          <li>
            <b>Pojedyncze przypadki mocno skaczą</b> (zobacz słupki). Dlatego patrzymy na średnią z
            kilku ostatnich, nie na jeden przypadek.
          </li>
          <li>
            Pominięte:{' '}
            {excludedNames.length > 0 && (
              <>
                {excludedNames.join(', ')} (sam wybór prac, bez plików, więc AI nie mogło podać
                ilości) oraz{' '}
              </>
            )}
            inwestycje, których właściciel jeszcze nie sprawdził.
          </li>
        </ul>
      </section>

      <section className="grid gap-4">
        <SectionHeader title="Wszystkie przypadki" />
        <AccuracyCasesTable cases={cases} />
        <Description size="xs">
          „AI miało dobrze” nie schodzi poniżej 0%: zdarzają się przypadki, w których błędy były
          większe niż cały kosztorys.
        </Description>
      </section>
    </div>
  )
}
