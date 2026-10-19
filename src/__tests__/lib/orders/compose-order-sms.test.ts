import { describe, expect, it } from 'vitest'

import { composeOrderSms } from '@/lib/orders/compose-order-sms'

const ADDRESS = { street: 'ul. Polna 3', postalCode: '00-001', city: 'Warszawa' }

describe('composeOrderSms', () => {
  it('writes the order, the address and the site contact', () => {
    expect(
      composeOrderSms({
        kind: 'bigBag',
        quantity: 2,
        address: ADDRESS,
        contact: { name: 'Jan Kowalski', phone: '601 234 567' },
      }),
    ).toBe(
      [
        'Dzień dobry,',
        '',
        'Prosimy o zamówienie:',
        '2 × big bag',
        'Adres: ul. Polna 3, 00-001 Warszawa',
        '',
        'Kontakt na miejscu: Jan Kowalski, 601 234 567',
        '',
        'Będę wdzięczny za potwierdzenie.',
        '',
        'Dzięki,',
        'Zespół Wykończymy',
      ].join('\n'),
    )
  })

  it('drops the contact paragraph when there is no contact', () => {
    const sms = composeOrderSms({ kind: 'container', quantity: 1, address: ADDRESS, contact: undefined })

    expect(sms).toContain('1 × kontener')
    expect(sms).not.toContain('Kontakt na miejscu')
    expect(sms).toContain('Adres: ul. Polna 3, 00-001 Warszawa\n\nBędę wdzięczny')
  })
})
