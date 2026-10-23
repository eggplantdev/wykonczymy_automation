import { ArrowDownToLine, MessageSquareOff, PackagePlus, Repeat } from 'lucide-react'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Description } from '@/components/ui/description'
import { Panel } from '@/components/ui/panel'
import { SectionHeader } from '@/components/ui/section-header'
import type { AiAccuracyT } from '@/lib/kosztorys/ai-accuracy'
import { AccuracyCasesTable } from './accuracy-cases-table'
import { AccuracyCauseCard } from './accuracy-cause-card'
import { AccuracyErrorTypePie } from './accuracy-error-type-pie'
import { AccuracyHero } from './accuracy-hero'
import { AccuracyMethodCompare } from './accuracy-method-compare'
import { AccuracyRepeatsChart } from './accuracy-repeats-chart'
import { AccuracyShareBar } from './accuracy-share-bar'
import { AccuracySteps } from './accuracy-steps'
import { AiAccuracyChart } from './ai-accuracy-chart'
import { formatCompactZloty, formatWholePercent } from './format'

const SECTION_CLASS = 'grid gap-5'

const REPEAT_GROUP_SWATCHES: Record<number, string> = {
  3: 'bg-chart-orange',
  2: 'bg-chart-pink',
  1: 'bg-muted-foreground/40',
}

const reasonSegments = (noReasonPercent: number) => [
  {
    id: 'none',
    label: 'Poprawione bez Powodu zmiany',
    percent: noReasonPercent,
    swatch: 'bg-chart-red',
  },
  {
    id: 'written',
    label: 'Z wpisanym Powodem zmiany',
    percent: 100 - noReasonPercent,
    swatch: 'bg-chart-green',
  },
]

type PropsT = {
  accuracy: AiAccuracyT
  excludedNames: string[]
}

export function AiAccuracyReport({ accuracy, excludedNames }: PropsT) {
  const { windows, example, cases } = accuracy
  const lastCount = windows.last.count

  return (
    <div className="grid max-w-6xl gap-14">
      <div className="grid gap-4">
        <Description withIcon={false} className="max-w-prose leading-relaxed">
          AI czyta to, co przysłał klient, i proponuje ilości (AI przedmiar). Właściciel je sprawdza
          i wpisuje swój Przedmiar. Porównujemy jedno z drugim pozycja po pozycji, przeliczone na
          złotówki po Cenie j.m. Każdą recenzję widać tu przy następnym wejściu.
        </Description>
        <AccuracyHero all={windows.all} last={windows.last} latest={cases.at(-1)} />
      </div>

      <section className={SECTION_CLASS}>
        <SectionHeader title="Wynik w czasie" />
        <Panel className="p-5 shadow-sm">
          <AiAccuracyChart cases={cases} allPercent={windows.all.rightPercent} />
        </Panel>
      </section>

      <section className={SECTION_CLASS}>
        <div className="grid gap-2">
          <SectionHeader title="Skąd biorą się błędy" />
          <Description withIcon={false} className="max-w-prose leading-relaxed">
            Przy każdej wycenie AI czyta Manual i Komentarze do pracy. Powodów zmiany ani
            poprawionych liczb nie widzi: poprawka trafia do jego wiedzy dopiero wtedy, gdy ktoś
            przeniesie jej Powód do Komentarza do pracy albo do Manualu.
          </Description>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <AccuracyCauseCard
            order={1}
            icon={MessageSquareOff}
            accent="red"
            title="Poprawki bez Powodu zmiany nie ma czego przenieść do wiedzy AI"
            stat={formatWholePercent(windows.last.noReasonPercent)}
            statCaption={`złotówek błędu bez powodu w ostatnich ${lastCount}`}
          >
            <AccuracyShareBar
              caption={`Wszystkie przypadki (${cases.length})`}
              segments={reasonSegments(windows.all.noReasonPercent)}
            />
            <AccuracyShareBar
              caption={`Ostatnie ${lastCount}`}
              segments={reasonSegments(windows.last.noReasonPercent)}
            />
            <Description size="xs">
              W pierwszych przypadkach nikt jeszcze nie wpisywał powodów, stąd tam 100%.
            </Description>
          </AccuracyCauseCard>

          <AccuracyCauseCard
            order={2}
            icon={Repeat}
            accent="orange"
            title="Te same pozycje są mylone w wielu wycenach"
            stat={formatWholePercent(accuracy.repeatedSharePercent)}
            statCaption="złotówek błędu w pozycjach pomylonych co najmniej 2 razy"
          >
            <p>
              Gładzie, glazura, gruntowanie czy punkty wod-kan są prawie w każdym kosztorysie, więc
              pomyłki na nich się sumują. Powtórka nie znaczy, że brakuje zasady: najpierw sprawdź
              Komentarz do pracy tej pozycji.
            </p>
            <AccuracyShareBar
              caption="Jak często AI myli tę samą pozycję"
              segments={accuracy.repeatGroups.map((group) => ({
                id: String(group.groupOrder),
                label: group.howOften,
                percent: group.sharePercent,
                swatch: REPEAT_GROUP_SWATCHES[group.groupOrder],
                detail: `${group.pozycje} poz. · ${formatCompactZloty(group.wrongZl)}`,
              }))}
            />
          </AccuracyCauseCard>

          <AccuracyCauseCard
            order={3}
            icon={PackagePlus}
            accent="pink"
            title="Pozycje, które AI dało, a właściciel wyzerował"
            stat={formatWholePercent(windows.last.extraPercent)}
            statCaption={`błędu w ostatnich ${lastCount}`}
          >
            <p>
              Bez Powodu zmiany nie wiadomo, czy praca jest zbędna, czy nie dajemy jej w pierwszej
              ofercie, więc nie ma czego przenieść do Komentarza do pracy.
            </p>
            <p>
              Zły wariant, czyli ta sama ilość przeniesiona na inną pozycję tej samej pracy, liczymy
              osobno, jako różnicę wartości obu pozycji.
            </p>
            <AccuracyErrorTypePie
              caption={`Rodzaj błędu, ostatnie ${lastCount}`}
              window={windows.last}
            />
          </AccuracyCauseCard>

          <AccuracyCauseCard
            order={4}
            icon={ArrowDownToLine}
            accent="purple"
            title="Świadome zaniżenie lub zawyżenie zawsze z Powodem zmiany"
          >
            <p>
              Właściciel czasem specjalnie zaniża Przedmiar w pierwszej ofercie, a resztę dolicza po
              wykonaniu. Bez Powodu zmiany takiej decyzji nie da się odróżnić od poprawki błędu AI,
              ani na tej stronie, ani przy przenoszeniu wiedzy do Komentarzy.
            </p>
            <p>
              Jeśli Powód zawiera „zaniżam”, „niedoszacowane” albo „powykonawczo”, wynik liczy
              liczbę AI jako dobrą. Świadomego zawyżenia strona nie rozpoznaje i liczy je jako błąd
              AI.
            </p>
          </AccuracyCauseCard>
        </div>
      </section>

      {accuracy.repeats.length > 0 && (
        <section className={SECTION_CLASS}>
          <div className="grid gap-2">
            <SectionHeader title="Pozycje, które AI myli najczęściej" />
            <Description withIcon={false} className="max-w-prose leading-relaxed">
              Pozycje pomylone w co najmniej 3 przypadkach, według złotówek błędu. Najedź, żeby
              zobaczyć, przy ilu poprawkach wpisano powód.
            </Description>
          </div>
          <Panel className="p-5 shadow-sm">
            <AccuracyRepeatsChart repeats={accuracy.repeats} />
          </Panel>
        </section>
      )}

      <section className={SECTION_CLASS}>
        <SectionHeader title="Co z tym zrobić" />
        <AccuracySteps />
      </section>

      <div className="grid gap-4">
        {example && (
          <CollapsibleSection
            title="Jak liczymy wynik"
            defaultOpen={false}
            storageKey="ai-accuracy-method"
          >
            <AccuracyMethodCompare example={example} />
          </CollapsibleSection>
        )}
        <CollapsibleSection
          title="Dlaczego wynik nie jest dokładny"
          defaultOpen={false}
          storageKey="ai-accuracy-caveats"
        >
          <ul className="grid max-w-prose list-disc gap-2 pt-4 pl-5 text-sm leading-relaxed">
            <li>
              <b>Celowe zaniżenia bez Powodu i każde celowe zawyżenie</b> liczymy jako błąd AI.{' '}
              <span className="text-muted-foreground">Prawdziwy wynik: wyższy.</span>
            </li>
            <li>
              <b>Zły wariant rozpoznajemy tylko wtedy,</b> gdy obie pozycje są w tej samej sekcji,
              to ta sama praca w tej samej jednostce, a ilości różnią się najwyżej o 2%. Każdą inną
              zamianę liczymy dwa razy: jako pozycję dodaną i pominiętą.{' '}
              <span className="text-muted-foreground">Prawdziwy wynik: trochę wyższy.</span>
            </li>
            <li>
              <b>Właściciel zwykle widzi liczby AI przed swoją wyceną.</b> Jeśli przyjął liczbę AI
              bez sprawdzenia, liczy się ona jako dobra.{' '}
              <span className="text-muted-foreground">Prawdziwy wynik: trochę niższy.</span>
            </li>
            <li>
              <b>Pojedyncze przypadki mocno skaczą</b> (zobacz słupki). Dlatego patrzymy na średnią
              z kilku ostatnich, nie na jeden przypadek.
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
        </CollapsibleSection>
      </div>

      <section className={SECTION_CLASS}>
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
