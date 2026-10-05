import { describe, it, expect } from 'vitest'
import { retranslationNotice, translationFillNotice } from '@/lib/utils/notice'

describe('translationFillNotice', () => {
  it('says there was nothing to do when nothing was filled and nothing failed', () => {
    expect(translationFillNotice({ items: 0, sections: 0, failed: 0 })).toEqual({
      message: 'Wszystko jest już przetłumaczone',
      kind: 'info',
    })
  })

  it('counts opisy and nazwy sekcji on the rozpiska, opisy alone on the katalog', () => {
    expect(translationFillNotice({ items: 3, sections: 1, failed: 0 })).toEqual({
      message: 'Przetłumaczono opisy: 3, nazwy sekcji: 1',
      kind: 'success',
    })
    expect(translationFillNotice({ items: 2, failed: 0 })).toEqual({
      message: 'Przetłumaczono opisy: 2',
      kind: 'success',
    })
  })

  it('warns with the failed count, even when nothing landed', () => {
    expect(translationFillNotice({ items: 0, sections: 0, failed: 4 })).toEqual({
      message: 'Przetłumaczono opisy: 0, nazwy sekcji: 0 — nie udało się: 4. Spróbuj ponownie.',
      kind: 'warning',
    })
  })
})

describe('retranslationNotice', () => {
  it('tells a Polish line apart from an unchanged answer and a new one', () => {
    expect(retranslationNotice('Wniesienie płyt', null).kind).toBe('info')
    expect(retranslationNotice('Wniesienie płyt', null).message).toMatch(/po polsku/)
    expect(retranslationNotice('Wniesienie płyt', 'Wniesienie płyt')).toEqual({
      message: 'Tłumaczenie bez zmian',
      kind: 'info',
    })
    expect(retranslationNotice(undefined, 'Wniesienie płyt')).toEqual({
      message: 'Przetłumaczono',
      kind: 'success',
    })
  })
})
