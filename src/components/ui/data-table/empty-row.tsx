export function EmptyRow({
  colSpan,
  message = 'Brak danych',
}: {
  colSpan: number
  message?: string
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-muted-foreground px-4 py-8 text-center">
        {message}
      </td>
    </tr>
  )
}
