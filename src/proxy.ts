import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasToken = request.cookies.has('payload-token')

  const isAuthPage = pathname.startsWith('/zaloguj')

  // Not logged in → redirect to login
  if (!hasToken && !isAuthPage) {
    return NextResponse.redirect(new URL('/zaloguj', request.url))
  }

  // Logged in → redirect away from login page
  if (hasToken && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
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
