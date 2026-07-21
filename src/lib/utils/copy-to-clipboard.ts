import { toastMessage } from '@/lib/utils/toast'

// Fire-and-forget clipboard write with a success/failure toast. The failure path matters and is not
// theoretical: `navigator.clipboard` is undefined on insecure origins (would throw synchronously past
// this fire-and-forget caller), and `writeText` rejects when the document isn't focused. Both surface
// as the same failure toast rather than a silent no-op.
export function copyToClipboard(text: string, successMessage: string): void {
  if (!navigator.clipboard) return void toastMessage('Nie udało się skopiować.', 'error')
  void navigator.clipboard
    .writeText(text)
    .then(() => toastMessage(successMessage, 'success'))
    .catch(() => toastMessage('Nie udało się skopiować.', 'error'))
}
