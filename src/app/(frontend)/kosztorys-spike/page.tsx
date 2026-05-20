import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'

export default async function KosztorysSpikeIndexPage() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'investments',
    limit: 100,
    sort: 'name',
    overrideAccess: true,
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-foreground text-lg font-medium">Kosztorys — Univer spike</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Pick an investment to open its kosztorys. Workbook lives in Vercel Blob, keyed by investment
        id. Seed from the spike page if the investment has no workbook yet.
      </p>

      <ul className="border-border divide-border mt-6 divide-y rounded border">
        {docs.map((inv) => (
          <li key={inv.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <div className="flex flex-col">
              <span className="text-foreground font-medium">{inv.name}</span>
              {inv.address ? (
                <span className="text-muted-foreground text-xs">{inv.address}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-xs">{inv.status}</span>
              <Link
                href={`/kosztorys-spike/${inv.id}`}
                className="bg-primary text-primary-foreground rounded px-3 py-1 text-xs"
              >
                Open
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
