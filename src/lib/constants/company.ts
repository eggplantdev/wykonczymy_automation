// Our own NIPs. A faktura prints the buyer's NIP beside the seller's, so a read equal to one of
// these is the model picking the wrong party — it would make every faktura look like one seller.
export const COMPANY_NIPS: readonly string[] = ['9372492352', '1182271075']
