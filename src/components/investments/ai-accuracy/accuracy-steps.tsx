import { Panel } from '@/components/ui/panel'
import { Description } from '@/components/ui/description'

const STEPS = [
  {
    title: 'Powód zmiany przy każdej poprawce',
    body: 'Wystarczy krótko: „klient nie chce”, „z rzutu wychodzi mniej”, „u nas zawsze 2 warstwy”. Świadome zaniżenie lub zawyżenie zawsze z Powodem, np. „zaniżam, doliczymy po wykonaniu”. Bez Powodu poprawka zostaje w tym jednym kosztorysie.',
  },
  {
    title: 'Przepisać zasady, których AI się nie trzyma',
    body: 'Dla pozycji z wykresu wyżej przeczytać jej Komentarz do pracy. Jeśli zasada jest, a AI dalej się myli, to albo jest niejasna, albo właściciel wycenia inaczej, niż mówi: wtedy przepisać zasadę, a nie dopisywać drugiej. Jeśli jej nie ma, dopisać ją w Komentarzu tej pozycji. Manual zostaje dla zasad, które nie dotyczą jednej pozycji.',
  },
  {
    title: 'Przy wyzerowanej pozycji napisać, co zamiast',
    body: 'Gdy AI wybrało zły wariant, Powód mówi, który jest właściwy i kiedy, np. „Q4 tam, gdzie LED świeci na ścianę”. Gdy pozycji w ogóle nie dajemy: „nie dajemy w pierwszej ofercie, chyba że…”.',
  },
  {
    title: 'Wynik po każdym przypadku',
    body: 'Ta strona pokazuje go od razu po recenzji. Pojedynczy przypadek skacze o kilkadziesiąt punktów, więc o tym, czy zmiana pomogła, mówi dopiero kilka kolejnych przypadków, nie jeden.',
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
