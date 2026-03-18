import { create } from 'zustand'

type HeaderFieldsStoreT = {
  visibility: Record<string, boolean>
  toggle: (label: string) => void
  reset: () => void
}

export const useHeaderFieldsStore = create<HeaderFieldsStoreT>()((set) => ({
  visibility: {},

  toggle: (label) =>
    set((state) => ({
      visibility: { ...state.visibility, [label]: !(state.visibility[label] ?? true) },
    })),

  reset: () => set({ visibility: {} }),
}))
