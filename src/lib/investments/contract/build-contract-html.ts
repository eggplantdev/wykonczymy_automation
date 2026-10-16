import { CONTRACT_SECTIONS } from '@/lib/investments/contract/clauses'
import { CONTRACT_CLAUSE_FIELDS, CONTRACTOR } from '@/lib/investments/contract/constants'
import { CONTRACT_PRINT_STYLES } from '@/lib/investments/contract/styles'
import type {
  ContractClauseFieldT,
  ContractFormT,
  ContractPointT,
  ContractSectionT,
} from '@/lib/investments/contract/types'
import { escapeHtml } from '@/lib/utils/escape-html'
import { formatPLDate } from '@/lib/utils/format-date'

type ArgsT = {
  form: ContractFormT
}

const FIELD_TOKEN = new RegExp(`\\{(${CONTRACT_CLAUSE_FIELDS.join('|')})\\}`, 'g')

export function buildContractHtml({ form }: ArgsT): string {
  const date = form.signDate ? formatPLDate(form.signDate) : ''

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>${escapeHtml(pageTitle(form))}</title>
<style>${CONTRACT_PRINT_STYLES}</style>
</head>
<body>
<h1>UMOWA nr ${fill(form.number)}</h1>
<p>zawarta w dniu ${fill(date)} r. w ${fill(form.place)} („Umowa”) pomiędzy:</p>
<div class="party">
${line('Imię i nazwisko / nazwa firmy', form.clientName)}
${form.isCompany ? '' : line('PESEL', form.clientPesel)}
${line('Adres', form.clientAddress)}
<p>zwanym dalej (Zamawiającym)</p>
</div>
<p class="connector">a</p>
<div class="party">
<p><strong>${CONTRACTOR.name}</strong> z siedzibą w ${CONTRACTOR.seat}, ${CONTRACTOR.address}, posiadającą NIP ${CONTRACTOR.nip}, zarejestrowaną w ${CONTRACTOR.court} pod nr KRS ${CONTRACTOR.krs},</p>
<p>reprezentowaną przez:<br>${CONTRACTOR.representative},</p>
<p>zwaną dalej (Przyjmującym zamówienie).</p>
</div>
<p>Zamawiający i Przyjmujący zamówienie będą zwani łącznie „Stronami”, a osobno „Stroną”. Strony postanawiają, co następuje:</p>
${CONTRACT_SECTIONS.map((section) => sectionHtml(section, form)).join('\n')}
<div class="signatures"><div>Zamawiający</div><div>Przyjmujący zamówienie</div></div>
</body>
</html>`
}

// „Zapisz jako PDF" offers the <title> as the file name.
function pageTitle(form: ContractFormT): string {
  const number = form.number.trim()
  const client = form.clientName.trim()
  const head = number ? `Umowa nr ${number}` : 'Umowa'
  return client ? `${head} — ${client}` : head
}

function fill(value: string): string {
  return `<span class="fill">${escapeHtml(value)}</span>`
}

function line(label: string, value: string): string {
  return `<div class="line"><span>${escapeHtml(label)}</span>${fill(value)}</div>`
}

function withFields(text: string, form: ContractFormT): string {
  return escapeHtml(text).replace(FIELD_TOKEN, (_, field: ContractClauseFieldT) =>
    fill(form[field]),
  )
}

function sectionHtml(section: ContractSectionT, form: ContractFormT): string {
  const points = section.points.map((point, index) => pointHtml(point, index, form)).join('')
  return `<h2>${escapeHtml(section.title)}</h2>${points}`
}

function pointHtml(point: ContractPointT, index: number, form: ContractFormT): string {
  const subpoints = (point.subpoints ?? [])
    .map(
      (text, subIndex) =>
        `<div class="subpoint"><span class="n">${subIndex + 1})</span><span>${withFields(text, form)}</span></div>`,
    )
    .join('')
  return `<div class="point"><span class="n">${index + 1}.</span><div>${withFields(point.text, form)}${subpoints}</div></div>`
}
