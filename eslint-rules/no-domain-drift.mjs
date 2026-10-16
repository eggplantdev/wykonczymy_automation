// `kosztorys`, `przedmiar` and `pomiar` are absent from the stem list on purpose — Category A, the
// three sheet proper nouns with no clean English equivalent (AGENTS.md „Naming a financial figure").
const DOMAIN_DRIFT = Object.entries({
  bilans: 'balance',
  marza: 'margin',
  rabat: 'discount (the frozen RABAT enum value stays)',
  zaliczk: 'deposit / stageDeposit',
  wplat: 'deposit',
  wyplat: 'payout',
  robocizn: 'laborCosts',
  'strat[ay]': 'loss',
  korekt: 'correction (the frozen CORRECTION enum value stays)',
  etap: 'stage',
  saldo: 'registerBalance',
  sumaPrac: 'laborCostsNet',
  materialy: 'materials',
  doZaplaty: 'amountDue',
  wydatki: 'expense',
  reszta: 'remainder',
  doRozliczenia: 'outstanding',
  lacznie: 'combined',
  prace: 'labor / item',
  wykonan: 'executed',
  netto: 'net',
  brutto: 'gross',
}).map(([stem, fix]) => [new RegExp(`^${stem}`, 'i'), `${stem}* → ${fix}*`])

const FROZEN = new Set(['RABAT', 'KOREKTA'])

const CODE_VALUE_KEYS = new Set(['id', 'key', 'value', 'type'])

const splitWords = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[_\s]+/)
    .filter(Boolean)

function driftFor(name) {
  if (FROZEN.has(name)) return null
  for (const word of splitWords(name)) {
    if (FROZEN.has(word)) continue
    const hit = DOMAIN_DRIFT.find(([re]) => re.test(word))
    if (hit) return hit[1]
  }
  return null
}

export const noDomainDriftRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce one English identifier per domain concept; flag Polish-generic drift.',
    },
    schema: [],
    messages: {
      drift:
        'Domain-name drift: {{fix}}. One concept, one English name — see context/domain/02-glossary.md.',
    },
  },
  create(context) {
    const report = (node, fix) => context.report({ node, messageId: 'drift', data: { fix } })

    const checkStringValue = (node) => {
      if (typeof node.value !== 'string') return
      const fix = driftFor(node.value)
      if (fix) report(node, fix)
    }

    return {
      Identifier(node) {
        const fix = driftFor(node.name)
        if (fix) report(node, fix)
      },
      'TSLiteralType > Literal': checkStringValue,
      'Property > Literal.value'(node) {
        const key = node.parent.key
        const keyName = key?.type === 'Identifier' ? key.name : key?.value
        if (CODE_VALUE_KEYS.has(keyName)) checkStringValue(node)
      },
    }
  },
}
