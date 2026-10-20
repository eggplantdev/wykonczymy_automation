'use client'

import * as React from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'

import { cn } from '@/lib/utils/cn'
import { buttonVariants } from '@/components/ui/button'
import { DIALOG_FOOTER_CLASS, DIALOG_TITLE_CLASS } from '@/components/ui/dialog'
import { useOverlayPreview } from '@/components/ui/overlay-preview'

const ALERT_DIALOG_SURFACE_CLASS =
  'bg-background max-w-dialog-sm w-full rounded-lg border p-6 shadow-lg'

function AlertDialog({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root {...props} />
}

function AlertDialogPortal({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return <AlertDialogPrimitive.Portal {...props} />
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-10001 bg-black/50',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  onOverlayClick,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content> & {
  // Radix hard-wires an outside click to do nothing on an alert dialog, so a caller for which the
  // overlay means „back" has to hear the click on the overlay itself.
  onOverlayClick?: () => void
}) {
  const isPreview = useOverlayPreview()
  if (isPreview) {
    return (
      <div className={cn(ALERT_DIALOG_SURFACE_CLASS, 'relative', className)}>{props.children}</div>
    )
  }

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay onClick={onOverlayClick} />
      <AlertDialogPrimitive.Content
        className={cn(
          ALERT_DIALOG_SURFACE_CLASS,
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-10001 -translate-x-1/2 -translate-y-1/2 duration-200',
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn('flex flex-col gap-2 text-left', className)}
      {...props}
    />
  )
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(DIALOG_FOOTER_CLASS, 'mt-4', className)}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title className={cn(DIALOG_TITLE_CLASS, className)} {...props} />
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return <AlertDialogPrimitive.Action className={cn(buttonVariants(), className)} {...props} />
}

function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  const isPreview = useOverlayPreview()
  // Radix's Cancel reads the context only AlertDialog.Content provides, which a preview never mounts.
  if (isPreview) {
    const { asChild: _asChild, ...buttonProps } = props
    return (
      <button
        type="button"
        className={cn(buttonVariants({ variant: 'outline' }), className)}
        {...buttonProps}
      />
    )
  }

  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: 'outline' }), className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
}
