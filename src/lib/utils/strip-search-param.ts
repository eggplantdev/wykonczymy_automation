import { buildUrlWithParams } from './build-url-with-params'

// The History API rather than `router.replace`, which navigates and re-renders the page's server
// tree. Either way Next discards every server action still in flight, so strip a deep link only
// once the reads it started have settled or stopped mattering — on close, not on arrival.
export function stripSearchParam(param: string) {
  const { pathname, search } = window.location
  if (!new URLSearchParams(search).has(param)) return
  window.history.replaceState(null, '', buildUrlWithParams(pathname, search, { [param]: '' }))
}
