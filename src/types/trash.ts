export type TrashKindT =
  | 'investment'
  | 'template'
  | 'cash-register'
  | 'worker'
  | 'vehicle'
  | 'equipment'
  | 'lead'

export type TrashRowT = {
  kind: TrashKindT
  id: number
  name: string
  trashedAt: Date
  /** Whole days until the cron purges it; meaningless when `autoPurges` is false. */
  daysLeft: number
  /** False for an investment whose kosztorys was used — only a manual delete removes it. */
  autoPurges: boolean
  /** Whether the row opens a kosztorys v1 (the Google sheet) — only an investment can. */
  hasSheet: boolean
  /** The kasy that went to the trash with a worker — empty for every other kind. */
  pairedRegisters: string[]
  /** What tells two rows of one name apart — three „szlifierka" are three different tools. */
  detail?: string
}

export type DeleteForeverResultT =
  | { ok: true }
  | { ok: false; reason: 'not-trashed' | 'blocked' | 'error'; message: string }
