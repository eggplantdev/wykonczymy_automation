/**
 * Largest file the fast path (`/api/media-upload`) takes. Read by the client router and the route,
 * so the two can never disagree. Below Vercel's 4.5 MB function body cap with room for the
 * multipart envelope — past the cap the platform answers 413 before our code runs.
 */
export const FAST_UPLOAD_MAX_BYTES = 4 * 1024 * 1024
