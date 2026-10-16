import type { ReactNode } from 'react'

type ColumnTotalRowPropsT = {
  visibleColumnIds: string[]
  columnId: string
  label: string
  children: ReactNode
}

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
