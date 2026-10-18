import React from 'react'
import { type VariantProps } from 'class-variance-authority'
import { iconVariants } from './icon-variants'
import ArrowIcon from './arrow-icon'
import DropdownIcon from './dropdown-icon'
import MenuDotsIcon from './menu-dots-icon'
import { cn } from '@/lib/utils/cn'

type PropsT = VariantProps<typeof iconVariants> & {
  wrapperClassName?: string
  className?: string
  iconName: 'arrowLeft' | 'arrowRight' | 'dropdownDown' | 'menuDots'
}

const iconRegistry = {
  arrowLeft: ArrowIcon,
  arrowRight: ArrowIcon,
  dropdownDown: DropdownIcon,
  menuDots: MenuDotsIcon,
}

const additionalProps: Record<string, object> = {
  arrowLeft: { direction: 'left' },
  arrowRight: { direction: 'right' },
  dropdownDown: { direction: 'down' },
}

export default function Icon({ size, className, iconName, wrapperClassName }: PropsT) {
  const SelectedIcon = iconRegistry[iconName] as React.ComponentType<PropsT>
  const extraProps = additionalProps[iconName] ?? {}

  return (
    <div className={cn('flex size-4 items-center justify-center', wrapperClassName)}>
      <SelectedIcon size={size} className={className} iconName={iconName} {...extraProps} />
    </div>
  )
}
