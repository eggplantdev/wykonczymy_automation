import { RATE_LABELS } from '@/lib/kosztorys/labels'
import {
  catalogueRateText,
  type CatalogueRateColumnsT,
} from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import { formatPLN } from '@/lib/utils/format-currency'

export type CataloguePricesT = CatalogueRateColumnsT & { clientPrice: number }

type CategorisedPricesT = CataloguePricesT & { category: string | null }

const NO_CATEGORY = 'bez kategorii'

// Rendered for both sides so „nadpisz" is a decision about numbers rather than about a name. An
// EMPTY kategoria is a value like any other — hence `undefined` (not falsiness) hides the row, so
// „bez kategorii" still renders on both sides.
export function PriceList({
  title,
  prices,
  category,
}: {
  title: string
  prices: CataloguePricesT
  category?: string | null
}) {
  const rows: [string, string, boolean][] = [
    ['Cena j.m.', formatPLN(prices.clientPrice), true],
    [RATE_LABELS.w_tools, catalogueRateText(prices, 'w_tools'), true],
    [RATE_LABELS.own_tools, catalogueRateText(prices, 'own_tools'), true],
    ...(category !== undefined
      ? ([['Kategoria', category || NO_CATEGORY, false]] as [string, string, boolean][])
      : []),
  ]
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs">{title}</p>
      {rows.map(([label, value, numeric]) => (
        <div key={label} className="flex justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className={numeric ? 'tabular-nums' : undefined}>{value}</span>
        </div>
      ))}
    </div>
  )
}

// `|| null`, not `??`: an empty kategoria and a missing one are the same thing to the owner, and
// the Payload admin can leave `''` in the column where every in-app write folds it to NULL.
export const categoriesDiffer = (existing: CategorisedPricesT, candidate: CategorisedPricesT) =>
  (existing.category || null) !== (candidate.category || null)

/** What an overwrite loses, figure by figure — the katalog keeps no history to recover it from. */
export function overwriteSentence(
  existing: CategorisedPricesT,
  candidate: CategorisedPricesT,
  changesCategory: boolean,
): string {
  const figures = `Cena j.m. ${formatPLN(existing.clientPrice)} → ${formatPLN(candidate.clientPrice)}, ${RATE_LABELS.w_tools.toLowerCase()} ${catalogueRateText(existing, 'w_tools')} → ${catalogueRateText(candidate, 'w_tools')}, ${RATE_LABELS.own_tools.toLowerCase()} ${catalogueRateText(existing, 'own_tools')} → ${catalogueRateText(candidate, 'own_tools')}.`
  const category = changesCategory
    ? ` Kategoria w katalogu zmieni się z „${existing.category || NO_CATEGORY}" na „${candidate.category || NO_CATEGORY}".`
    : ''
  return `Stare stawki przepadną — katalog nie trzyma historii. ${figures}${category} Kosztorysy, w których ta praca już siedzi, zostają bez zmian.`
}
