import { POLISH_MEDIA, type TranslatorT } from '@/lib/i18n/translations'
import type { BlockedFileError } from '@/lib/utils/process-upload-file'
import { toastMessage } from '@/lib/utils/toast'

// TODO(EX-958) SENTRY-REQUIRED: blocked-file ingest failures (unconvertible HEIC) must be captured
// once Sentry is wired — currently surfaced only as a user toast.
export function reportBlockedFiles(
  blocked: BlockedFileError[],
  translator: TranslatorT<'media'> = POLISH_MEDIA,
) {
  if (blocked.length === 0) return
  toastMessage(blockedFilesMessage(blocked, translator), 'error', 8000)
}

// react-toastify collapses newlines in HTML — a multi-file block would otherwise run together.
function blockedFilesMessage(blocked: BlockedFileError[], { t }: TranslatorT<'media'>) {
  return (
    <div>
      {blocked.map((error, index) => (
        <p key={index}>{t('convertFailed', { name: error.filename })}</p>
      ))}
    </div>
  )
}
