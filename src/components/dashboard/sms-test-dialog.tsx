'use client'

import { useState } from 'react'
import { MessageCircle, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

function toWhatsAppNumber(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 9 ? `48${digits}` : digits
}

export function SmsTestDialog() {
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')

  const body = encodeURIComponent(message)
  const smsHref = `sms:${phone.replace(/\s/g, '')}?&body=${body}`
  const whatsAppHref = `whatsapp://send?phone=${toWhatsAppNumber(phone)}&text=${body}`
  const isDisabled = !phone.trim()

  return (
    <>
      <Button variant="outline" className="justify-self-start" onClick={() => setOpen(true)}>
        Wyślij wiadomość (test)
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader title="Wyślij wiadomość" />
          <div className="grid gap-2">
            <Label htmlFor="sms-test-phone">Numer</Label>
            <Input
              id="sms-test-phone"
              type="tel"
              placeholder="601 234 567"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sms-test-message">Wiadomość</Label>
            <Textarea
              id="sms-test-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isDisabled}
              onClick={() => {
                window.location.href = smsHref
              }}
            >
              <MessageSquare />
              SMS
            </Button>
            <Button
              disabled={isDisabled}
              onClick={() => {
                window.location.href = whatsAppHref
              }}
            >
              <MessageCircle />
              WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
