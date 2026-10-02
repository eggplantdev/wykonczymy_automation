type LeadIdentityT = {
  id: number
  name?: string | null
  email?: string | null
  phone?: string | null
}

/** The name /kosz shows and the „Usuń na zawsze" confirm asks to be typed. */
export const leadDisplayName = ({ id, name, email, phone }: LeadIdentityT): string =>
  name?.trim() || email?.trim() || phone?.trim() || `Zgłoszenie #${id}`
