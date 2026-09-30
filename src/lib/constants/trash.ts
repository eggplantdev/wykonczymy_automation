// Its own module because collection hooks read it, and `server-only` throws in the Payload CLI graph.

export const CASH_REGISTER_TRASHED_MESSAGE = 'Kasa jest w koszu — przywróć ją, żeby coś zmienić.'

export const CASH_REGISTER_OWNER_LOCKED_MESSAGE =
  'Nie można zmienić właściciela kasy, która ma transakcje.'

// Investments, szablony and kasy share it; the file trash keeps its own, shorter window.
export const ENTITY_TRASH_RETENTION_DAYS = 30
