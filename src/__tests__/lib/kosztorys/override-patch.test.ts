import { describe, expect, it } from 'vitest'
import { normalizeOverridePatch } from '@/lib/kosztorys/override-patch'

// EX-865. The grid sends ONE field per save, so every case here is a single-key patch — that is the
// only shape the action ever receives, and the whole point is what the second column does in reply.
describe('normalizeOverridePatch — najwyżej jedno źródło po każdym zapisie', () => {
  it('ustawienie mnożnika zeruje kwotę', () => {
    expect(normalizeOverridePatch({ wToolsOverrideCoeff: 0.8 })).toEqual({
      wToolsOverrideCoeff: 0.8,
      wToolsOverrideValue: null,
    })
  })

  it('ustawienie kwoty zeruje mnożnik', () => {
    expect(normalizeOverridePatch({ wToolsOverrideValue: 42 })).toEqual({
      wToolsOverrideValue: 42,
      wToolsOverrideCoeff: null,
    })
  })

  // Droga powrotna do „auto" — i jedyna dziura, jaką dwie kolumny mają bez tej normalizacji:
  // zgubiona połowa wystawiłaby z powrotem starą kwotę, czytaną jako zwykłe nadpisanie.
  it('wyczyszczenie mnożnika czyści OBIE kolumny', () => {
    expect(normalizeOverridePatch({ wToolsOverrideCoeff: null })).toEqual({
      wToolsOverrideCoeff: null,
      wToolsOverrideValue: null,
    })
  })

  it('wyczyszczenie kwoty czyści OBIE kolumny', () => {
    expect(normalizeOverridePatch({ wToolsOverrideValue: null })).toEqual({
      wToolsOverrideValue: null,
      wToolsOverrideCoeff: null,
    })
  })

  // `0` to wybór źródła, nie jego brak — inaczej wpisanie zera wracałoby do „auto" i płaciło ekipie
  // według współczynnika inwestycji.
  it('zero jest wartością, nie wyczyszczeniem — po obu stronach', () => {
    expect(normalizeOverridePatch({ wToolsOverrideCoeff: 0 })).toEqual({
      wToolsOverrideCoeff: 0,
      wToolsOverrideValue: null,
    })
    expect(normalizeOverridePatch({ wToolsOverrideValue: 0 })).toEqual({
      wToolsOverrideValue: 0,
      wToolsOverrideCoeff: null,
    })
  })

  it('płaszczyzny są rozdzielone — zapis na jednej nie rusza drugiej', () => {
    expect(normalizeOverridePatch({ ownToolsOverrideCoeff: 0.4 })).toEqual({
      ownToolsOverrideCoeff: 0.4,
      ownToolsOverrideValue: null,
    })
  })

  it('łatka bez stawki przechodzi nietknięta', () => {
    const patch = { clientPrice: 120, description: 'Gładzie' }
    expect(normalizeOverridePatch(patch)).toEqual(patch)
  })

  // Import i katalog wysyłają obie kolumny naraz. Rozwinięcie nie ma prawa nadpisać tego, co
  // wołający już rozstrzygnął.
  it('łatka niosąca obie kolumny pary zostaje taka, jaka przyszła', () => {
    const patch = { wToolsOverrideValue: null, wToolsOverrideCoeff: 0.8 }
    expect(normalizeOverridePatch(patch)).toEqual(patch)
  })

  it('nie mutuje wejścia', () => {
    const patch = { wToolsOverrideCoeff: 0.8 }
    normalizeOverridePatch(patch)
    expect(patch).toEqual({ wToolsOverrideCoeff: 0.8 })
  })
})
