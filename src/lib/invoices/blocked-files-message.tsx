import type { BlockedFileError } from '@/lib/utils/process-upload-file'
import { toastMessage } from '@/lib/utils/toast'

/**
 * Both pick surfaces — the expense form's rows and the transfers table's invoice cell — must report
 * a blocked batch identically, so the guard and the toast's duration live here rather than at each
 * call site.
 */
// TODO(EX-449) SENTRY-REQUIRED: blocked-file ingest failures (unconvertible HEIC) must be captured
// once Sentry is wired — currently surfaced only as a user toast.
export function reportBlockedFiles(blocked: BlockedFileError[]) {
  if (blocked.length === 0) return
  toastMessage(blockedFilesMessage(blocked), 'error', 8000)
}

// One Polish line per blocked file in a single toast so one bad file in a batch never spams N
// toasts. Rendered as JSX rather than a "\n"-joined string because react-toastify collapses
// newlines in HTML — a multi-file block would otherwise run together.
function blockedFilesMessage(blocked: BlockedFileError[]) {
  return (
    <div>
      {blocked.map((error, index) => (
        <p key={index}>
          {`Nie udało się przekonwertować „${error.filename}” — zapisz jako JPG i spróbuj ponownie.`}
        </p>
      ))}
    </div>
  )
}
