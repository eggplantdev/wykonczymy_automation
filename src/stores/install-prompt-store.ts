import { create } from 'zustand'

type BeforeInstallPromptEventT = Event & { prompt: () => Promise<unknown> }

type InstallPromptStoreT = {
  held: BeforeInstallPromptEventT | undefined
  promptUsed: boolean
  installed: boolean
  showInstallPrompt: () => void
}

export const useInstallPromptStore = create<InstallPromptStoreT>()((set, get) => ({
  held: undefined,
  promptUsed: false,
  installed: false,
  // The event can prompt only once, so it is dropped whatever the answer.
  showInstallPrompt: () => {
    void get().held?.prompt().catch(() => {})
    set({ held: undefined, promptUsed: true })
  },
}))

// Chrome fires `beforeinstallprompt` once per document load, often before the page that shows the
// button has mounted — or on a different page altogether — so the event is held here, from module
// load, rather than in the button.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    useInstallPromptStore.setState({ held: event as BeforeInstallPromptEventT })
  })
  window.addEventListener('appinstalled', () => useInstallPromptStore.setState({ installed: true }))
  void (navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> })
    .getInstalledRelatedApps?.()
    .then((apps) => {
      if (apps.length > 0) useInstallPromptStore.setState({ installed: true })
    })
    .catch(() => {})
}
