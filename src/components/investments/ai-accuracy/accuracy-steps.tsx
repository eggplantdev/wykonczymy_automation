import { Panel } from '@/components/ui/panel'
import { Description } from '@/components/ui/description'

const STEPS = [
  {
    title: 'Powód zmiany przy każdej poprawce',
    body: 'Wystarczy krótko: „klient nie chce”, „z rzutu wychodzi mniej”, „u nas zawsze 2 warstwy”. Przy celowym zaniżeniu zawsze ten sam dopisek: „celowo zaniżam”. Bez tego żadna z pozostałych rzeczy nie zadziała.',
  },
  {
    title: 'Najpierw zasady dla pozycji, które się powtarzają',
    body: 'Właściciel siada raz na pół godziny i dla każdej pozycji z wykresu wyżej mówi jedną zasadę: kiedy ją dajemy, kiedy nie i jak liczymy ilość. Te zasady trafiają do Manualu. To najtańszy sposób, żeby zbić największą część błędu.',
  },
  {
    title: 'Przejrzeć pozycje, które AI dodaje, a właściciel wyrzuca',
    body: 'Spisać, czego nie dajemy w pierwszej ofercie, jeśli klient o to nie prosił, i wpisać to jako zasadę „nie dodawaj, chyba że…”.',
  },
  {
    title: 'Wynik po każdym przypadku',
    body: 'Ta strona pokazuje go od razu po recenzji. Jeśli zmiana w sposobie pracy AI nie podniosła średniej z ostatnich przypadków, nie dokładamy kolejnej, tylko wracamy do punktów 1–3.',
  },
  {
    title: 'Co jakiś czas jeden przypadek „na ślepo”',
    body: 'Właściciel wycenia sam, zanim zobaczy wersję AI, potem porównujemy. Tylko tak wiemy, czy wynik nie jest zawyżony przez to, że właściciel zaczyna od liczb AI.',
  },
] as const

export function AccuracySteps() {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {STEPS.map((step, index) => (
        <li key={step.title} className="contents">
          <Panel className="grid content-start gap-2 p-5">
            <span className="from-chart-blue to-chart-purple bg-linear-to-br bg-clip-text text-4xl font-bold text-transparent tabular-nums">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="font-semibold text-balance">{step.title}</h3>
            <Description withIcon={false} className="leading-relaxed">
              {step.body}
            </Description>
          </Panel>
        </li>
      ))}
    </ol>
  )
}
