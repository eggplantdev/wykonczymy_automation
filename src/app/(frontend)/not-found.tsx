import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'

export default function NotFound() {
  return (
    <EmptyState title="Nie znaleziono" description="Nie udało się znaleźć żądanego zasobu">
      <Link href="/" className="text-primary text-sm underline underline-offset-4 hover:opacity-80">
        Wróć na stronę główną
      </Link>
    </EmptyState>
  )
}
