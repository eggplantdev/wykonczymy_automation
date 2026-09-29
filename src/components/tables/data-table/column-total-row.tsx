import type { ReactNode } from 'react'

type ColumnTotalRowPropsT = {
  visibleColumnIds: string[]
  columnId: string
  label: string
  children: ReactNode
}

/** A footer row holding one column's total under that column, the label spanning everything to its
 *  left. Gone with the column itself. */
export function ColumnTotalRow({
  visibleColumnIds,
  columnId,
  label,
  children,
}: ColumnTotalRowPropsT) {
  const index = visibleColumnIds.indexOf(columnId)
  if (index < 0) return null

  return (
    <tr>
      {/* Nothing to its left once every other column is toggled off — the number is what the row is
          for, so it survives losing its label. */}
      {index > 0 && (
        <td className="font-bold" colSpan={index}>
          {label}
        </td>
      )}
      <td className="text-right font-bold tabular-nums">{children}</td>
      {visibleColumnIds.slice(index + 1).map((id) => (
        <td key={id} />
      ))}
    </tr>
  )
}
