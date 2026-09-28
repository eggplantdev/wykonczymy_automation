import {
  ACCEPTANCE_KIND_LABELS,
  CONTRACTOR_NAME,
} from '@/lib/kosztorys/acceptance-protocol/constants'
import { scopeQuantityText } from '@/lib/kosztorys/acceptance-protocol/scope-rows'
import { protocolSettlementLines } from '@/lib/kosztorys/acceptance-protocol/settlement'
import { PROTOCOL_PRINT_STYLES } from '@/lib/kosztorys/acceptance-protocol/styles'
import type {
  AcceptanceKindT,
  AcceptanceProtocolFormT,
  ProtocolScopeRowT,
  ProtocolSettlementT,
} from '@/lib/kosztorys/acceptance-protocol/types'
import { escapeHtml } from '@/lib/utils/escape-html'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'

type ArgsT = {
  form: AcceptanceProtocolFormT
  scope: ProtocolScopeRowT[]
  settlement: ProtocolSettlementT
  logoUrl: string
}

const KIND_LINES: Record<AcceptanceKindT, string> = {
  partial: `odbiór ${ACCEPTANCE_KIND_LABELS.partial} (etap prac),`,
  final: `odbiór ${ACCEPTANCE_KIND_LABELS.final},`,
  reinspection: `${ACCEPTANCE_KIND_LABELS.reinspection} odbiór po usunięciu wad z protokołu z dnia ${fill('')}`,
}

const DOCUMENT_LINES = [
  'deklaracje właściwości użytkowych, atesty i karty gwarancyjne materiałów i urządzeń,',
  'protokoły badań i pomiarów (np. instalacji elektrycznej, próby szczelności instalacji),',
  'zdjęcia instalacji przed zakryciem, rysunki powykonawcze, instrukcje obsługi,',
  'klucze, piloty, niewykorzystane materiały Zamawiającego.',
]

const RESULT_LINES = [
  'Prace odebrano bez zastrzeżeń.',
  'Prace odebrano z wadami nieistotnymi wpisanymi w pkt 4. Wykonawca usunie je w terminach z tabeli; wady nieistotne nie wstrzymują odbioru ani zapłaty, chyba że umowa stanowi inaczej.',
  'Zamawiający odmawia odbioru z powodu wad istotnych wpisanych w pkt 4, które uniemożliwiają korzystanie z przedmiotu prac zgodnie z przeznaczeniem albo są wyraźnie sprzeczne z umową. Wykonawca usunie wady i ponownie zgłosi prace do odbioru.',
]

const DEFECT_ROWS = 4
const REMARK_LINES = 4

export function buildProtocolHtml({ form, scope, settlement, logoUrl }: ArgsT): string {
  const placeDate = [form.place.trim(), printDate(form.issueDate)].filter(Boolean).join(', ')
  const kinds = (Object.keys(KIND_LINES) as AcceptanceKindT[])
    .map((kind) => boxLine(KIND_LINES[kind], kind === form.kind))
    .join('')

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>${escapeHtml(pageTitle(form))}</title>
<style>${PROTOCOL_PRINT_STYLES}</style>
</head>
<body>
<div class="head">
<img src="${escapeHtml(logoUrl)}" alt="">
<div class="place-date">${fill(placeDate)}<div class="caption">(miejscowość, data)</div></div>
</div>
<h1>PROTOKÓŁ ODBIORU PRAC</h1>
<p>Rodzaj odbioru (zaznacz jedno):</p>
<ul class="boxes">${kinds}</ul>
${line('Miejsce wykonania prac (adres)', form.siteAddress)}
<div class="pair">${line('Data odbioru', printDate(form.acceptanceDate))}${line('data zgłoszenia gotowości do odbioru', printDate(form.readinessDate))}</div>
<h3>Zamawiający:</h3>
${line('Imię i nazwisko / nazwa firmy', form.clientName)}
<h3>Wykonawca:</h3>
${line('Imię i nazwisko / nazwa firmy', CONTRACTOR_NAME)}

<h2>1. Zakres odbieranych prac</h2>
<table>
<colgroup><col class="c-lp"><col><col class="c-qty"><col class="c-check"></colgroup>
<thead><tr><th>Lp.</th><th>Prace (pomieszczenie, rodzaj, etap)</th><th>Ilość i jedn.</th><th>Zgodnie z umową?</th></tr></thead>
<tbody>${scope.map(scopeRow).join('')}</tbody>
</table>

<h2>2. Dokumenty przekazane Zamawiającemu (zaznacz)</h2>
<ul class="boxes">${DOCUMENT_LINES.map((text) => boxLine(escapeHtml(text), false)).join('')}</ul>

<h2>3. Wynik odbioru (zaznacz jedno)</h2>
<ul class="boxes">${RESULT_LINES.map((text) => boxLine(escapeHtml(text), false)).join('')}</ul>

<h2>4. Stwierdzone wady</h2>
<table>
<colgroup><col class="c-lp"><col><col class="c-severity"><col class="c-deadline"></colgroup>
<thead><tr><th>Lp.</th><th>Opis wady i miejsce</th><th>Istotna / nieistotna</th><th>Termin usunięcia</th></tr></thead>
<tbody>${Array.from({ length: DEFECT_ROWS }, (_, index) => `<tr><td>${index + 1}</td><td></td><td></td><td></td></tr>`).join('')}</tbody>
</table>
<p class="note">Wadę nieusuwalną strony mogą rozliczyć obniżeniem wynagrodzenia (wpisz w pkt 5). Odbiór bez zastrzeżeń nie wyłącza odpowiedzialności Wykonawcy z rękojmi i gwarancji za wady ukryte, ujawnione po odbiorze.</p>

<h2>5. Rozliczenie (kwoty netto)</h2>
${settlementTable(settlement)}
${line('Termin zapłaty', printDate(form.paymentDueDate))}
${line('Obniżenie wynagrodzenia z powodu wad (zł) i jego podstawa', '')}
${line('Okres rękojmi i gwarancji liczy się od dnia', printDate(form.acceptanceDate))}

<h2>6. Uwagi i stanowiska stron</h2>
${'<div class="blank-line"></div>'.repeat(REMARK_LINES)}

<div class="closing">
<p>Protokół sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze stron. Podpis nie oznacza zgody na treść uwag drugiej strony, jeżeli strona wpisała w pkt 6 swoje zastrzeżenia.</p>
<div class="signatures"><div>Zamawiający (odbierający)</div><div>Wykonawca (przekazujący)</div></div>
</div>
</body>
</html>`
}

// „Zapisz jako PDF" offers the <title> as the file name.
function pageTitle(form: AcceptanceProtocolFormT): string {
  const client = form.clientName.trim()
  return client ? `Protokół odbioru prac — ${client}` : 'Protokół odbioru prac'
}

function printDate(value: string): string {
  return value ? formatPLDate(value) : ''
}

// Escapes its own value, so every form field reaches the page through one door.
function fill(value: string): string {
  return `<span class="fill">${escapeHtml(value)}</span>`
}

function line(label: string, value: string): string {
  return `<div class="line"><span>${escapeHtml(label)}</span>${fill(value)}</div>`
}

function boxLine(html: string, isChecked: boolean): string {
  return `<li><span class="box${isChecked ? ' checked' : ''}">${isChecked ? '✕' : ''}</span><span>${html}</span></li>`
}

function scopeRow(row: ProtocolScopeRowT, index: number): string {
  return (
    `<tr><td>${index + 1}</td>` +
    `<td><span class="section-name">${escapeHtml(row.sectionName)} — </span>${escapeHtml(row.description)}</td>` +
    `<td>${escapeHtml(scopeQuantityText(row))}</td><td></td></tr>`
  )
}

function settlementTable(settlement: ProtocolSettlementT): string {
  const rows = protocolSettlementLines(settlement)
    .map(
      ({ label, amount, emphasis }) =>
        `<tr${emphasis ? ` class="${emphasis}"` : ''}><td>${escapeHtml(label)}</td>` +
        `<td class="num">${escapeHtml(formatPLN(amount))}</td></tr>`,
    )
    .join('')
  return `<table class="settlement"><tbody>${rows}</tbody></table>`
}
