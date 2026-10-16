import { describe, expect, it } from 'vitest'
import { offPlaneDepositSentence } from '@/lib/kosztorys/off-plane-deposit-copy'
import { formatPLN } from '@/lib/utils/format-currency'

describe('offPlaneDepositSentence', () => {
  it('in tryb brutto names the kwota that pays nothing down', () => {
    const sentence = offPlaneDepositSentence({ count: 2, amount: 4000 }, 'GROSS')

    expect(sentence).toBe(
      `Rozliczenie brutto, a 2 wpłaty są gotówką — ${formatPLN(4000)} nie spłaca nic. ` +
        'Jeśli klient płaci obiema drogami, ustaw rozliczenie mieszane.',
    )
  })

  it('in tryb netto says the tryb is wrong without claiming a złoty was lost', () => {
    const sentence = offPlaneDepositSentence({ count: 1, amount: 1230 }, 'NET')

    expect(sentence).toBe(
      'Rozliczenie netto, a 1 wpłata jest przelewem. ' +
        'Jeśli klient płaci obiema drogami, ustaw rozliczenie mieszane.',
    )
    expect(sentence).not.toContain('nie spłaca nic')
  })

  it('declines the counted noun, so „5 wpłata" can never reach the owner', () => {
    expect(offPlaneDepositSentence({ count: 5, amount: 100 }, 'GROSS')).toContain('5 wpłat jest')
  })
})
