import { create } from 'zustand'

type HeaderFieldsStoreT = {
  visibility: Record<string, boolean>
  toggle: (label: string) => void
  reset: (defaultHidden?: string[]) => void
}

export const useHeaderFieldsStore = create<HeaderFieldsStoreT>()((set) => ({
  visibility: {},

  toggle: (label) =>
    set((state) => ({
      visibility: { ...state.visibility, [label]: !(state.visibility[label] ?? true) },
    })),

  reset: (defaultHidden) =>
    set({
      visibility: defaultHidden
        ? Object.fromEntries(defaultHidden.map((label) => [label, false]))
        : {},
    }),
}))
