import { NextResponse } from 'next/server'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { getWorkbook } from '@/lib/kosztorys/blob'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ investmentId: string }> },
) {
  const user = await getCurrentUserJwt()
  if (!user) return NextResponse.json({ error: 'Brak uprawnień' }, { status: 401 })

  const { investmentId } = await params
  const id = Number(investmentId)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid investmentId' }, { status: 400 })
  }

  try {
    const workbook = await getWorkbook(id)
    if (!workbook) {
      return NextResponse.json({ error: 'Workbook not seeded' }, { status: 404 })
    }
    return NextResponse.json(workbook, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    // "blob does not exist" can also surface here if head() throws unexpectedly —
    // treat it as 404 so the client shows the seed CTA instead of an error toast
    if (msg.toLowerCase().includes('does not exist') || msg.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Workbook not seeded' }, { status: 404 })
    }
    console.error('[kosztorys/workbook] GET failed:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
