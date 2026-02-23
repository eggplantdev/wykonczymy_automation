type MailtoLinkPropsT = {
  readonly email: string
}

export function MailtoLink({ email }: MailtoLinkPropsT) {
  return (
    <a href={`mailto:${email}`} className="text-primary hover:underline">
      {email}
    </a>
  )
}
