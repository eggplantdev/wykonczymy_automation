import { TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export function AlertIcon({ className }: { className?: string }) {
  return <TriangleAlert className={cn('text-destructive shrink-0', className)} aria-hidden />
}
