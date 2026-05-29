// Generic card-list section used three times on /kosztorysy. Header line
// shows the title + count; an empty list renders a muted note instead of the
// <ul>. Kept local to this route because no other page uses this exact shape.

type SectionPropsT<T> = {
  title: string
  emptyMessage: string
  rows: T[]
  renderRow: (row: T) => React.ReactNode
}

export function Section<T>({ title, emptyMessage, rows, renderRow }: SectionPropsT<T>) {
  return (
    <section className="space-y-3">
      <h2 className="text-foreground text-lg font-medium">
        {title} <span className="text-muted-foreground text-sm">({rows.length})</span>
      </h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      ) : (
        <ul className="grid gap-2">{rows.map(renderRow)}</ul>
      )}
    </section>
  )
}
