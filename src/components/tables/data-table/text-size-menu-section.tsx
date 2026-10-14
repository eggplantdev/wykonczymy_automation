'use client'

import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { type TableTextSizeT } from '@/components/tables/data-table/table-text-size'
import { useTranslation } from '@/hooks/use-translation'

const LABEL_KEYS = {
  '2xs': 'textSizeExtraSmall',
  xs: 'textSizeSmall',
  sm: 'textSizeMedium',
  base: 'textSizeLarge',
} as const satisfies Record<TableTextSizeT, string>

type PropsT<T extends TableTextSizeT> = {
  sizes: readonly T[]
  value: T
  onChange: (size: T) => void
}

export function TextSizeMenuSection<T extends TableTextSizeT>({
  sizes,
  value,
  onChange,
}: PropsT<T>) {
  const { t } = useTranslation('filters')
  return (
    <>
      <DropdownMenuLabel>{t('textSize')}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={value}
        onValueChange={(next) => {
          const size = sizes.find((candidate) => candidate === next)
          if (size) onChange(size)
        }}
      >
        {sizes.map((size) => (
          <DropdownMenuRadioItem
            key={size}
            value={size}
            // Open, so the table behind shows the size before the menu goes.
            onSelect={(event) => event.preventDefault()}
          >
            {t(LABEL_KEYS[size])}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  )
}
