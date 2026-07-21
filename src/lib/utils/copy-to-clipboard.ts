import { toastMessage } from '@/lib/utils/toast'

// Fire-and-forget clipboard write with a success/failure toast. The failure path matters: the
// Clipboard API rejects on insecure origins and when the document isn't focused, so a silent copy
// that quietly did nothing is a real failure mode, not a theoretical one.
export function copyToClipboard(text: string, successMessage: string): void {
  void navigator.clipboard
    .writeText(text)
    .then(() => toastMessage(successMessage, 'success'))
    .catch(() => toastMessage('Nie udało się skopiować.', 'error'))
}
