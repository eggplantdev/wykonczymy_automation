// Its own module because collection hooks read it, and `server-only` throws in the Payload CLI graph.

export const CASH_REGISTER_TRASHED_MESSAGE = 'Kasa jest w koszu — przywróć ją, żeby coś zmienić.'

export const CASH_REGISTER_OWNER_LOCKED_MESSAGE =
  'Nie można zmienić właściciela kasy, która ma transakcje lub zgłoszenia wydatków do rozpatrzenia.'
