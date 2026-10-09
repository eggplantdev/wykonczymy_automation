export const TRANSFER_VIEWS = ['table', 'list'] as const
export type TransferViewT = (typeof TRANSFER_VIEWS)[number]

// One key for every transfers listing: a phone user who picked cards wants them on each page.
export const TRANSFER_VIEW_STORAGE_KEY = 'transfers:view'
