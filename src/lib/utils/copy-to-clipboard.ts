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

// For text a server round-trip still has to produce. Must be CALLED inside the click handler: Safari
// refuses a clipboard write that starts after an await, so the write starts now and the text arrives
// later as a Promise-valued ClipboardItem. Where ClipboardItem is missing, `writeText` after the
// promise is the best left — it works wherever the browser does not tie the write to the gesture.
//
// A rejected `text` is the caller's failure and the caller's toast: reporting „nie udało się
// skopiować" on top of „nie udało się wygenerować linku" would name the wrong cause.
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
