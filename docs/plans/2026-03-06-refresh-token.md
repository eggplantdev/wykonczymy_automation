# Refresh Token Flow

## Status: Future

## Problem

JWT tokens expire after 24h. When a token expires mid-session, the user is silently redirected to the login page with no warning. No refresh token mechanism exists — Payload CMS doesn't support it natively.

## Desired Behavior

- Transparently refresh the JWT before it expires so active users stay logged in
- Show a notification if the session truly expires (e.g. user was inactive)

## Possible Approaches

1. **Silent refresh via API route** — a client-side interval calls a `/api/auth/refresh` route handler that issues a new JWT (requires DB round-trip to verify user still exists/active)
2. **Sliding session in proxy** — proxy checks JWT expiry claim (`exp`), if close to expiring, calls Payload API to re-issue token and sets new cookie on response
3. **Payload plugin/hook** — intercept requests server-side, auto-refresh if token is within a refresh window

## Notes

- Payload signs JWTs with `jose` using `PAYLOAD_SECRET`. Any custom refresh logic needs to use the same signing approach.
- Trade-off: refresh tokens add complexity and a new attack surface (token theft). For a small internal app, a longer JWT TTL (e.g. 7 days) might be simpler.
- Payload's `auth.tokenExpiration` config can extend the default 24h window as a quick win.
