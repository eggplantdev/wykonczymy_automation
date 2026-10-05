// TEMPORARY (TODO(EX-449)): with no Sentry yet, this flattens the provider's real failure reason
// into the toast string so it survives protectedAction (which returns only `err.message`) and
// reaches the client. Once Sentry is wired the raw fields (statusCode/responseBody/text) move into
// the capture and the toast shrinks to a clean Polish message.
export function providerErrorDetail(error: unknown, fallback: string): string {
  const err = error as {
    message?: string
    text?: string
    statusCode?: number
    responseBody?: string
    response?: { body?: unknown }
  }
  const providerBody = err.responseBody ?? err.response?.body
  return [
    err.message ?? fallback,
    err.statusCode ? `HTTP ${err.statusCode}` : undefined,
    providerBody
      ? typeof providerBody === 'string'
        ? providerBody
        : JSON.stringify(providerBody)
      : undefined,
    err.text ? `model: ${err.text}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
}
