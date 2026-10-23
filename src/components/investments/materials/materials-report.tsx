import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Description } from '@/components/ui/description'
import { Panel } from '@/components/ui/panel'
import { SectionHeader } from '@/components/ui/section-header'
import { formatPLN } from '@/lib/utils/format-currency'
import type { MaterialRowT, MaterialTypeTotalT } from '@/lib/materials/types'
import { MaterialsDataTable } from './materials-data-table'
import { MaterialsHero } from './materials-hero'
import { MaterialsTypeChart } from './materials-type-chart'

const SECTION_CLASS = 'grid gap-5'
const TOP_TYPES = 15

const typeTotals = (rows: MaterialRowT[]): MaterialTypeTotalT[] =>
  [...Map.groupBy(rows, (row) => row.type)]
    .map(([type, group]) => ({
      type,
      gross: group.reduce((sum, row) => sum + row.gross, 0),
      count: group.length,
    }))
    .sort((first, second) => second.gross - first.gross)
    .slice(0, TOP_TYPES)

type PropsT = {
  rows: MaterialRowT[]
  priceListDate: string
}

export function MaterialsReport({ rows, priceListDate }: PropsT) {
  const materials = rows.filter((row) => row.kind === 'materiał')
  const multiShop = materials.filter((row) => row.shopNames.length > 1)
  const shopCount = new Set(rows.flatMap((row) => row.shopNames)).size
  const gross = materials.reduce((sum, row) => sum + row.gross, 0)

  return (
    <div className="grid gap-14">
      <CollapsibleSection
        title="Podsumowanie"
        storageKey="materials:summary"
        withSeparator={false}
        className="max-w-6xl"
      >
        <div className="grid gap-4">
          <Description withIcon={false} className="max-w-prose leading-relaxed">
            Wszystko, co kupiliśmy na budowy, z faktur Telmaku i z paragonów wpiętych do transakcji.
            Ten sam produkt z różnych sklepów jest jedną pozycją, więc widać, gdzie był najtańszy i
            ile go zeszło. Stan na {priceListDate}.
          </Description>
          <MaterialsHero
            eyebrow="Cennik materiałów budowlanych"
            title={`${materials.length} materiałów z ${shopCount} sklepów`}
            lead={`${multiShop.length} z nich kupujemy w kilku sklepach. Rozrzut ceny pokazuje, ile można zaoszczędzić, kupując zawsze tam, gdzie taniej.`}
            stats={[
              { label: 'Materiały', value: String(materials.length) },
              { label: 'Rodzaje', value: String(new Set(materials.map((row) => row.type)).size) },
              { label: 'W kilku sklepach', value: String(multiShop.length) },
              { label: 'Wydano brutto', value: formatPLN(Math.round(gross)) },
            ]}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Na co idą pieniądze"
        storageKey="materials:type-chart"
        withSeparator={false}
        className="max-w-6xl"
      >
        <Panel className="p-5 shadow-sm">
          <MaterialsTypeChart totals={typeTotals(materials)} />
        </Panel>
      </CollapsibleSection>

      <section className={`${SECTION_CLASS} min-w-0 [&>*]:min-w-0`}>
        <SectionHeader title="Wszystkie materiały" />
        <MaterialsDataTable data={rows} />
      </section>
    </div>
  )
}
