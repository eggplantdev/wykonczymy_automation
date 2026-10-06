import { useTranslation } from '@/hooks/use-translation'

export function EmptyRow({ colSpan, message }: { colSpan: number; message?: string }) {
  const { t } = useTranslation('filters')
  return (
    <tr>
      <td colSpan={colSpan} className="text-muted-foreground px-4 py-8 text-center">
        {message ?? t('noData')}
      </td>
    </tr>
  )
}
