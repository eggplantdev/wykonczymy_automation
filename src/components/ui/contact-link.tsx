type ContactLinkPropsT = {
  type: 'email' | 'phone'
  value: string | undefined
}

const PROTOCOL = { email: 'mailto:', phone: 'tel:' } as const

export function ContactLink({ type, value }: ContactLinkPropsT) {
  if (!value) return '—'

  return (
    <a href={`${PROTOCOL[type]}${value}`} className="text-primary hover:underline">
      {value}
    </a>
  )
}
