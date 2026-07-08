import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type FormStoreT<TValues> = {
  formData: TValues | null
  updateFormData: (data: TValues) => void
  resetFormData: () => void
}

export function createFormStore<TValues>(name: string) {
  return create<FormStoreT<TValues>>()(
    persist(
      (set) => ({
        formData: null,
        updateFormData: (data) =>
          set((state) => {
            if (JSON.stringify(state.formData) === JSON.stringify(data)) return state
            return { formData: data }
          }),
        resetFormData: () => set({ formData: null }),
      }),
      {
        name,
        storage: createJSONStorage(() => sessionStorage),
      },
    ),
  )
}
