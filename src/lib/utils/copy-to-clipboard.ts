import { toastMessage } from '@/lib/utils/toast'

// `navigator.clipboard` is undefined on insecure origins (would throw synchronously past this
// fire-and-forget caller)
export function copyToClipboard(text: string, successMessage: string): void {
  if (!navigator.clipboard) return void toastMessage('Nie udało się skopiować.', 'error')
  void navigator.clipboard
    .writeText(text)
    .then(() => toastMessage(successMessage, 'success'))
    .catch(() => toastMessage('Nie udało się skopiować.', 'error'))
}

// Must be CALLED inside the click handler: Safari refuses a clipboard write that starts after an await
export function copyToClipboardAsync(text: Promise<string>, successMessage: string): void {
  let textFailed = false
  const guarded = text.catch((error: unknown) => {
    textFailed = true
    throw error
  })
  const write = !navigator.clipboard
    ? guarded.then(() => Promise.reject(new Error('clipboard unavailable')))
    : typeof ClipboardItem === 'function'
      ? navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': guarded.then((value) => new Blob([value], { type: 'text/plain' })),
          }),
        ])
      : guarded.then((value) => navigator.clipboard.writeText(value))
  void write
    .then(() => toastMessage(successMessage, 'success'))
    .catch(() => {
      if (!textFailed) toastMessage('Nie udało się skopiować.', 'error')
    })
}
