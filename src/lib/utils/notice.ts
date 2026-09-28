// The WORDING and the timing of a notice, kept apart from `toast.ts`, which is the side effect that
// shows one. 22 specs mock that module to keep react-toastify out of jsdom, each factory naming only
// `toastMessage` — so a constant living there came back `undefined` in every one of them. Nothing has
// a reason to mock a string builder.

// Longer than toastMessage's 2s default: a notice fires as the user's eyes are already moving on, and
// it reports a figure that was just committed.
export const NOTICE_MS = 5000

// One sentence for a refused entry, so a grid cell and a settings field word the same refusal. The
// „przywrócono …" half is appended only where the refusal displaced a figure — garbage that displaced
// nothing is reported quietly.
export const rejectedEntryMessage = (
  restored: string | null,
  kind: 'invalid' | 'blocked' = 'invalid',
) =>
  `${kind === 'blocked' ? 'Wartość odrzucona' : 'Nieprawidłowa wartość'}${
    restored == null ? '' : ` — przywrócono ${restored}`
  }.`
