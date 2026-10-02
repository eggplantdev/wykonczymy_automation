type LeadIdentityT = {
  id: number
  name?: string | null
  email?: string | null
  phone?: string | null
}

/**
 * The name /kosz shows and the „Usuń na zawsze" confirm asks to be typed. A Facebook lead can arrive
 * with any of the three missing, so it falls through to whatever identifies the caller, and to the
 * id when nothing does.
 */
export const leadDisplayName = ({ id, name, email, phone }: LeadIdentityT): string =>
  name?.trim() || email?.trim() || phone?.trim() || `Zgłoszenie #${id}`
