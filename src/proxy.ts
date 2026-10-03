import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasToken = request.cookies.has('payload-token')

  const isAuthPage = pathname.startsWith('/zaloguj')
  // Public pages Meta's crawler must reach without a session (app publish requirement)
  const isPublicPage =
    pathname === '/privacy' || pathname === '/usuwanie-danych' || pathname === '/terms'
  // The client's and the worker's share views, and the worker's report form: the token in the URL
  // is the whole credential, so a session check here would make the feature unreachable for the only
  // audience it exists for. Authorization happens in the token lookup, which 404s on a revoked or
  // unknown token. The report form's Server Action POSTs to its own path, so it passes here too.
  const isSharePage =
    pathname.startsWith('/k/') ||
    pathname.startsWith('/p/') ||
    pathname.startsWith('/zgloszenie-prac/')

  // Not logged in → redirect to login
  if (!hasToken && !isAuthPage && !isPublicPage && !isSharePage) {
    return NextResponse.redirect(new URL('/zaloguj', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /admin (Payload admin panel)
     * - /api (Payload API routes)
     * - /_next (Next.js internals)
     * - Static assets (images, fonts, etc.)
     */
    '/((?!admin|api|_next|favicon\\.ico|fonts|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
}
