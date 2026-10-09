export const TRANSFER_VIEWS = ['table', 'list'] as const
export type TransferViewT = (typeof TRANSFER_VIEWS)[number]

export function parseTransferView(value: string | null): TransferViewT {
  return TRANSFER_VIEWS.find((view) => view === value) ?? 'table'
}
