type LeadIdentityT = {
  id: number
  name?: string | null
  email?: string | null
  phone?: string | null
}

export const leadDisplayName = ({ id, name, email, phone }: LeadIdentityT): string =>
  name?.trim() || email?.trim() || phone?.trim() || `Zgłoszenie #${id}`
