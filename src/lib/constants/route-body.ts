/**
 * Largest file a client posts to one of our Route Handlers. Below Vercel's 4.5 MB function body
 * cap with room for the multipart envelope — past the cap the platform answers 413 before the
 * handler runs, an error no handler can word for the user.
 */
export const ROUTE_BODY_MAX_BYTES = 4 * 1024 * 1024
