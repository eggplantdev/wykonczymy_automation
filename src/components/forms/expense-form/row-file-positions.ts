export function positionalFiles(
  lineItems: { id: string }[],
  byId: Map<string, File[]>,
): Map<number, File[]> {
  const positional = new Map<number, File[]>()
  lineItems.forEach((item, index) => {
    const files = byId.get(item.id)
    if (files?.length) positional.set(index, files)
  })
  return positional
}

export function filesByRowId(
  lineItems: { id: string }[],
  positional: Map<number, File[]>,
): Map<string, File[]> {
  const byId = new Map<string, File[]>()
  lineItems.forEach((item, index) => {
    const files = positional.get(index)
    if (files?.length) byId.set(item.id, files)
  })
  return byId
}
