import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useInlineRename } from '@/components/kosztorys/editor/hooks/use-inline-rename'

const onCommit = vi.fn()

beforeEach(() => vi.clearAllMocks())

type HookT = { current: ReturnType<typeof useInlineRename> }

function mount(stopEditing?: Parameters<typeof useInlineRename>[1]) {
  const rendered = renderHook(() => useInlineRename(onCommit, stopEditing))
  act(() => rendered.result.current.start('Kuchnia'))
  return rendered
}

function type(result: HookT, next: string) {
  act(() =>
    result.current.inputProps.onChange({
      target: { value: next },
    } as React.ChangeEvent<HTMLInputElement>),
  )
}

const keyEvent = (blur: () => void = () => {}) =>
  ({ currentTarget: { blur } }) as React.KeyboardEvent<HTMLInputElement>

describe('useInlineRename — wyjście przez unmount', () => {
  it('zapisuje to, co zostało wpisane, gdy input znika bez bluru', () => {
    const { result, unmount } = mount()

    type(result, 'Łazienka')
    unmount()

    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Łazienka')
  })

  it('nie zapisuje niczego, gdy nazwa nie została tknięta', () => {
    const { unmount } = mount()

    unmount()

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('nie wskrzesza szkicu porzuconego Escapem', () => {
    const { result, unmount } = mount()

    type(result, 'Łazienka')
    act(() =>
      result.current.inputProps.onEscape(keyEvent(() => result.current.inputProps.onBlur())),
    )
    unmount()

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('zapisuje raz, gdy blur i unmount trafiają w ten sam commit', () => {
    const { result, unmount } = mount()

    type(result, 'Łazienka')
    act(() => result.current.inputProps.onBlur())
    unmount()

    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Łazienka')
  })
})

describe('useInlineRename — oddanie komórki siatce', () => {
  it('po Enterze oddaje siatce i schodzi wiersz niżej', () => {
    const stopEditing = vi.fn()
    const { result } = mount(stopEditing)

    act(() => result.current.inputProps.onEnter(keyEvent()))

    expect(stopEditing).toHaveBeenCalledExactlyOnceWith({ nextRow: true })
  })

  it('bez `stopEditing` Enter nie wywraca się na braku wywołania zwrotnego', () => {
    const { result } = mount()

    expect(() => act(() => result.current.inputProps.onEnter(keyEvent()))).not.toThrow()
  })
})
