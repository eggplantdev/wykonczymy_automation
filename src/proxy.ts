import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasToken = request.cookies.has('payload-token')

  const isAuthPage = pathname.startsWith('/zaloguj')
  // Public pages Meta's crawler must reach without a session (app publish requirement)
  const isPublicPage =
    pathname === '/privacy' || pathname === '/usuwanie-danych' || pathname === '/terms'

  // Not logged in → redirect to login
  if (!hasToken && !isAuthPage && !isPublicPage) {
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
