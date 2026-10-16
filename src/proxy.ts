import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasToken = request.cookies.has('payload-token')

  const isAuthPage = pathname.startsWith('/zaloguj')
  // Public pages Meta's crawler must reach without a session (app publish requirement)
  const isPublicPage =
    pathname === '/privacy' || pathname === '/usuwanie-danych' || pathname === '/terms'
  // `/zgloszenie-prac/` and `/p/` are the worker links' retired homes, kept reachable for their
  // „link nieaktywny”.
  const isSharePage =
    pathname.startsWith('/k/') ||
    pathname.startsWith('/z/') ||
    pathname.startsWith('/zgloszenie-prac/') ||
    pathname.startsWith('/p/')

  if (!hasToken && !isAuthPage && !isPublicPage && !isSharePage) {
    return NextResponse.redirect(new URL('/zaloguj', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!admin|api|_next|favicon\\.ico|manifest\\.webmanifest|sw\\.js|fonts|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
}
