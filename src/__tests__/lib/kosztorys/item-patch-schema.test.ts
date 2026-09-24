import { describe, expect, it } from 'vitest'
import { itemPatchSchema } from '@/lib/kosztorys/item-patch-schema'

const parse = (patch: Record<string, unknown>) => itemPatchSchema.parse(patch)

// Wyczyszczenie stawki i stawka zero złotych to dwa różne polecenia, a `z.coerce.number()` zamienia
// null w 0 — więc gdyby `.nullable()` poszło ZA koercją, „wyczyść mnożnik" płaciłoby ekipie zero
// zamiast wracać do współczynnika inwestycji. Nie da się tego przypiąć na akcji: plik `'use server'`
// nie wyeksportuje schematu.
describe('itemPatchSchema — null to nie zero', () => {
  it('przepuszcza null na obu kolumnach każdej płaszczyzny', () => {
    expect(
      parse({
        wToolsOverrideValue: null,
        wToolsOverrideCoeff: null,
        ownToolsOverrideValue: null,
        ownToolsOverrideCoeff: null,
      }),
    ).toEqual({
      wToolsOverrideValue: null,
      wToolsOverrideCoeff: null,
      ownToolsOverrideValue: null,
      ownToolsOverrideCoeff: null,
    })
  })

  it('zero zostaje zerem, a tekst z inputu liczbą', () => {
    expect(parse({ wToolsOverrideCoeff: 0 })).toEqual({ wToolsOverrideCoeff: 0 })
    expect(parse({ ownToolsOverrideValue: '88.5' })).toEqual({ ownToolsOverrideValue: 88.5 })
  })

  it('pomija pola, których łatka nie niesie', () => {
    expect(parse({ clientPrice: 120 })).toEqual({ clientPrice: 120 })
  })
})
