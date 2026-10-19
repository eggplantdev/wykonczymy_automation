import NotFound from '@/app/(frontend)/not-found'

// Rendered, not thrown: a URL that matched no page left the client router unable to leave the 404
// (React #310).
export default function CatchAllPage() {
  return <NotFound />
}
