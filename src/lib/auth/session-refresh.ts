// At most one re-issue a day: the cookie write is cheap, but every slide also rewrites the user doc.
const SESSION_REFRESH_AFTER_MS = 24 * 60 * 60 * 1000

/** Whether a token minted at `issuedAtSec` (JWT `iat`) is old enough to slide forward. */
export const needsSessionRefresh = (issuedAtSec: number, nowMs = Date.now()): boolean =>
  nowMs - issuedAtSec * 1000 > SESSION_REFRESH_AFTER_MS
