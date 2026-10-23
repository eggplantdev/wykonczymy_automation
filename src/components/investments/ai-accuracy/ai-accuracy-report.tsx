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
          AI czyta to, co przysłał klient, i wpisuje Przedmiar. Właściciel go sprawdza i poprawia.
          Porównujemy liczby AI z ostatecznymi liczbami właściciela, przeliczone na złotówki po
          Cenie j.m. Każdą recenzję i poprawkę widać tu przy następnym wejściu.
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
            AI uczy się tylko z tego, co mu zapiszemy: z zasad w Manualu i z Powodów zmiany.
            Poprawiona liczba bez powodu to dla AI tylko inna liczba, więc następnym razem robi ten
            sam błąd.
          </Description>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <AccuracyCauseCard
            order={1}
            icon={MessageSquareOff}
            accent="red"
            title="Poprawka bez Powodu zmiany niczego AI nie uczy"
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
            title="AI powtarza te same błędy w kolejnych przypadkach"
            stat={formatWholePercent(accuracy.repeatedSharePercent)}
            statCaption="złotówek błędu w pozycjach pomylonych co najmniej 2 razy"
          >
            <p>
              To nie są przypadkowe wpadki, tylko stałe nawyki. Jedna zasada w Manualu naprawiłaby
              je wszędzie naraz.
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
            title="AI często dodaje pozycje, które właściciel wyrzuca"
            stat={formatWholePercent(windows.last.extraPercent)}
            statCaption={`błędu w ostatnich ${lastCount} to pozycje dodane „na wszelki wypadek”`}
          >
            <p>
              Tego nie da się odgadnąć z rzutu: AI nie wie, czego właściciel nie daje w pierwszej
              ofercie, dopóki mu tego nie powiemy.
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
            title="Celowe zaniżanie wygląda jak błąd AI"
          >
            <p>
              Właściciel czasem specjalnie zaniża Przedmiar w pierwszej ofercie, żeby nie wystraszyć
              klienta, a resztę dolicza po wykonaniu. Gdy to zapisze w Powodzie zmiany, nie liczymy
              tego jako błąd AI.
            </p>
            <p>
              Ale zwykle nic nie wpisuje. Wtedy AI widzi tylko „za dużo” i uczy się zaniżać tam,
              gdzie liczyło dobrze, a wynik liczy mu za to karę.
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
              <b>Celowe zaniżenia bez opisu</b> liczymy jako błąd AI.{' '}
              <span className="text-muted-foreground">Prawdziwy wynik: trochę wyższy.</span>
            </li>
            <li>
              <b>Właściciel widział liczby AI przed swoją wyceną</b> (we wszystkich przypadkach poza
              pierwszymi dwoma). Jeśli przyjął liczbę AI bez sprawdzenia, liczy się ona jako dobra.{' '}
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
