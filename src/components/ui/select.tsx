'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'

import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { useOverlayPreview } from '@/components/ui/overlay-preview'

// A preview never opens Radix's list (an open Select locks the page), so its items read the
// selected value from here.
const SelectPreviewValue = React.createContext<string | undefined>(undefined)

function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  const isPreview = useOverlayPreview()
  const root = <SelectPrimitive.Root data-slot="select" {...props} />
  return isPreview ? <SelectPreviewValue value={props.value}>{root}</SelectPreviewValue> : root
}

function SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

export const SELECT_TRIGGER_CLASS =
  'border-input data-placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive bg-background text-foreground flex w-full items-center justify-between gap-2 rounded-md border px-3 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-2 data-[size=default]:h-9 data-[size=sm]:h-8 data-[size=xs]:h-6 data-[size=xs]:px-2 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2'

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: 'xs' | 'sm' | 'default'
}) {
  const isPreview = useOverlayPreview()
  if (isPreview) return null

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(SELECT_TRIGGER_CLASS, className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectButtonTrigger({
  className,
  size = 'sm',
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & { size?: 'xs' | 'sm' }) {
  const isPreview = useOverlayPreview()
  if (isPreview) return null

  return (
    <SelectPrimitive.Trigger data-slot="select-trigger" asChild {...props}>
      {/* w-fit: this one is often dropped into a stacked flex column, where the default `stretch`
          would blow it to the column's width. */}
      <Button
        variant="outline"
        size={size}
        className={cn(
          'w-fit *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2',
          className,
        )}
      >
        {children}
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon className="text-muted-foreground" />
        </SelectPrimitive.Icon>
      </Button>
    </SelectPrimitive.Trigger>
  )
}

const SELECT_CONTENT_SURFACE_CLASS =
  'bg-popover text-popover-foreground border-input min-w-[8rem] rounded-md border shadow-md'

function SelectContent({
  className,
  children,
  position = 'item-aligned',
  align = 'center',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  const isPreview = useOverlayPreview()
  if (isPreview) {
    return (
      <div
        data-slot="select-content"
        className={cn(SELECT_CONTENT_SURFACE_CLASS, 'relative w-fit p-1', className)}
      >
        {children}
      </div>
    )
  }

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          SELECT_CONTENT_SURFACE_CLASS,
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-10001 max-h-(--radix-select-content-available-height) origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className,
        )}
        position={position}
        align={align}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            'p-1',
            position === 'popper' &&
              'h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width) scroll-my-1',
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn('text-muted-foreground px-2 py-1.5 text-xs', className)}
      {...props}
    />
  )
}

const SELECT_ITEM_CLASS =
  "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2"

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  const isPreview = useOverlayPreview()
  const previewValue = React.use(SelectPreviewValue)
  if (isPreview) {
    const isChecked = props.value === previewValue
    return (
      <div
        data-slot="select-item"
        data-state={isChecked ? 'checked' : 'unchecked'}
        data-disabled={props.disabled ? '' : undefined}
        className={cn(SELECT_ITEM_CLASS, className)}
      >
        <span
          data-slot="select-item-indicator"
          className="absolute right-2 flex size-3.5 items-center justify-center"
        >
          {isChecked && <CheckIcon />}
        </span>
        <span>{children}</span>
      </div>
    )
  }

  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(SELECT_ITEM_CLASS, className)}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-3.5 items-center justify-center"
      >
        <SelectPrimitive.ItemIndicator>
          <CheckIcon />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('bg-border pointer-events-none -mx-1 my-1 h-px', className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronDownIcon className="opacity-50" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectButtonTrigger,
  SelectValue,
}
