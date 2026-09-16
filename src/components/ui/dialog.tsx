'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-10000 bg-black/50',
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          // Below sm this is a full-height sheet, not a floating box: a centred `-translate-y-1/2`
          // card gets shoved around by the virtual keyboard, and `h-dvh` tracks the shrinking
          // viewport where `vh` does not. From sm up it is the centred box it always was.
          // A caller overriding width or height must therefore prefix it `sm:`, or it overrides
          // the sheet too.
          'bg-background fixed top-0 left-1/2 z-10000 flex h-dvh max-h-none w-full max-w-none -translate-x-1/2 flex-col gap-4 overflow-y-auto p-4 shadow-lg duration-200 outline-none',
          'sm:max-w-dialog sm:top-1/2 sm:h-fit sm:max-h-[90vh] sm:-translate-y-1/2 sm:rounded-lg sm:p-6',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4',
          'sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="text-foreground hover:bg-accent absolute top-2 right-2 rounded-md p-3 transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
            aria-label="Zamknij"
          >
            <X className="size-6" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({
  className,
  title,
  description,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  title?: string
  description?: string
}) {
  return (
    <div
      data-slot="dialog-header"
      // Right padding clears the dialog chrome floating over this row: the X always, and on a
      // phone the icon-only „Wyczyść formularz" beside it (ends ~96px in).
      className={cn('flex flex-col gap-2 pr-24 text-left sm:pr-10', className)}
      {...props}
    >
      {title ? (
        <>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </>
      ) : (
        children
      )}
    </div>
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg leading-none font-semibold', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
