import { Badge } from '@/components/ui/badge'
import { Description } from '@/components/ui/description'
import { Panel } from '@/components/ui/panel'
import { SectionHeader } from '@/components/ui/section-header'
import { formatPercent, formatQty } from '@/lib/kosztorys/format'
import type { MaterialT } from '@/lib/materials/types'
import { formatPLN } from '@/lib/utils/format-currency'
import { MaterialPriceChart } from './material-price-chart'
import { MaterialPurchasesTable } from './material-purchases-table'
import { MaterialShopsTable } from './material-shops-table'
import { MaterialsHero } from './materials-hero'

const SECTION_CLASS = 'grid gap-5'

type PropsT = {
  material: MaterialT
  investmentNames: ReadonlyMap<number, string>
}

export function MaterialDetail({ material, investmentNames }: PropsT) {
  const shops = material.shops.map((shop) => shop.shop)
  const points = material.purchases
    .filter((purchase) => !purchase.odd && purchase.net > 0)
    .map(({ shop, date, doc, qty, net }) => ({ shop, date, doc, qty, net, time: Date.parse(date) }))
  const isCompared = shops.length > 1

  return (
    <div className="grid max-w-6xl gap-14">
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="sky" shape="pill">
            {material.type}
          </Badge>
          <Badge tone="muted" shape="pill">
            Opakowanie {material.pack}
          </Badge>
          {material.kind !== 'materiał' && (
            <Badge tone="orange" shape="pill">
              {material.kind}
            </Badge>
          )}
        </div>
        <MaterialsHero
          eyebrow={isCompared ? `Najtaniej: ${material.cheapestShop}` : shops[0]}
          title={material.product}
          lead={
            isCompared
              ? `Kupowany w ${shops.length} sklepach. Najdroższy zakup był o ${formatPercent(material.spread)} droższy od najtańszego.`
              : 'Kupowany tylko w jednym sklepie.'
          }
          stats={[
            { label: 'Średnio netto', value: formatPLN(material.avgNet) },
            {
              label: 'Od – do',
              value: `${formatPLN(material.minNet)} – ${formatPLN(material.maxNet)}`,
            },
            { label: `Kupiono (${material.orders} zakupów)`, value: formatQty(material.qty) },
            {
              label: `Wydano brutto (${material.investments} inwestycji)`,
              value: formatPLN(material.gross),
            },
          ]}
        />
      </div>

      <section className={SECTION_CLASS}>
        <SectionHeader title="Ceny w sklepach" />
        <MaterialShopsTable shops={material.shops} cheapestShop={material.cheapestShop} />
      </section>

      {points.length > 1 && (
        <section className={SECTION_CLASS}>
          <SectionHeader title="Cena w czasie" />
          <Panel className="p-5 shadow-sm">
            <MaterialPriceChart shops={shops} points={points} />
          </Panel>
        </section>
      )}

      <section className={SECTION_CLASS}>
        <SectionHeader title="Zakupy" />
        <MaterialPurchasesTable purchases={material.purchases} investmentNames={investmentNames} />
      </section>

      <section className={SECTION_CLASS}>
        <div className="grid gap-2">
          <SectionHeader title="Nazwy na fakturach" />
          <Description withIcon={false} className="max-w-prose leading-relaxed">
            Tak ten materiał był zapisany na paragonach i fakturach.
          </Description>
        </div>
        <ul className="text-muted-foreground grid gap-1 text-sm">
          {material.names.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
