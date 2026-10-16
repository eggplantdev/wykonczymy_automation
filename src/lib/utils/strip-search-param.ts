import { buildUrlWithParams } from './build-url-with-params'

// Next discards every server action still in flight, so strip a deep link only once the reads it
// started have settled or stopped mattering — on close, not on arrival.
export function stripSearchParam(param: string) {
  const { pathname, search } = window.location
  if (!new URLSearchParams(search).has(param)) return
  window.history.replaceState(null, '', buildUrlWithParams(pathname, search, { [param]: '' }))
}
