import type { ComponentProps } from 'react'
import type { ColumnOrderDialog as RealColumnOrderDialog } from '@/components/ui/column-order-dialog'
import { rankForMove } from '@/lib/table/column-order'

// The pointer drag is framer's and has no jsdom equivalent, so this reaches the same commit the real
// dialog's `onDragEnd` reaches: `rankForMove` over the list it was handed, then `onSetRank`. The rank
// algebra behind it is unit-tested. A spec opts in with
// `vi.mock('@/components/ui/column-order-dialog', () => import('@/__tests__/stubs/column-order-dialog'))`.
export function ColumnOrderDialog(props: ComponentProps<typeof RealColumnOrderDialog>) {
  if (!props.open) return null
  const keys = props.items.map((item) => item.id)
  return (
    <section aria-label="Ustaw kolejność kolumn">
      <ol>
        {props.items.map((item) => (
          <li key={item.id}>{item.label}</li>
        ))}
      </ol>
      {props.items.map((item) => (
        <button
          key={item.id}
          onClick={() =>
            props.onSetRank(item.id, rankForMove(keys, item.id, 0, props.ranks, props.baseRanks))
          }
        >
          {`${item.label} na początek`}
        </button>
      ))}
      <button
        disabled={props.resetDisabled ?? Object.keys(props.ranks).length === 0}
        onClick={props.onReset}
      >
        Przywróć domyślną kolejność
      </button>
    </section>
  )
}
