// Real photos from production, read live by `pnpm test:receipts-ai`. The images stay out of git —
// they carry a car plate and the company's NIP — so they live in `dumps/receipt-eval/`, copied
// from the blob mirror (`dumps/blob-mirror`). `amounts` is every SUMA a person reads off the
// photo, checked by eye; a slip whose total is covered is not one of them. `sellerNip` is the NIP
// every slip on a one-seller photo carries — "" where none is printed (a parking ticket) — and is
// left out where the photo mixes shops.
export type ReceiptPhotoCaseT = {
  file: string
  amounts: number[]
  sellerNip?: string
  note: string
}

export const RECEIPT_PHOTO_CASES: ReceiptPhotoCaseT[] = [
  {
    file: '1791717044091740062792177510836-88da34744d6f.jpg',
    amounts: [59.76, 58.28, 68.76, 62.06],
    sellerNip: '1130089950',
    note: 'four Leroy Merlin paragony side by side (zgłoszenie #13)',
  },
  {
    file: '17917170972486654488988064276411-929aa783980b.jpg',
    amounts: [20.29, 73.72, 32.29, 22.17],
    sellerNip: '1130089950',
    note: 'four Leroy Merlin paragony, two of them overlapping (zgłoszenie #13)',
  },
  {
    file: '17917172011671780836356052887278-d2cae70b75ba.jpg',
    amounts: [20.8, 2.3, 2.3, 13.1, 2.7, 4.5, 20.8, 16.3, 9.9],
    sellerNip: '',
    note: 'nine parking tickets, repeated amounts (zgłoszenie #13)',
  },
  {
    file: '17917172725512971910402624828467-3f6d4dd44b8b.jpg',
    amounts: [32.1, 4.5, 13.1, 9.9, 7.2, 9.9, 20.8, 16.3, 2.3],
    sellerNip: '',
    note: 'nine parking tickets (zgłoszenie #13)',
  },
  {
    file: '17917173183344265895078855676310-b35b22540c84.jpg',
    amounts: [2.3, 20.8, 9.9, 25.3, 16.3, 4.5],
    sellerNip: '',
    note: 'six parking tickets (zgłoszenie #13)',
  },
  {
    file: 'IMG_20261009_141236-62a611f67d22.jpg',
    amounts: [4.49],
    sellerNip: '1130089950',
    note: 'a paragon lying on a parking ticket whose amount it covers (zgłoszenie #13)',
  },
  {
    file: 'IMG_4194.jpg',
    amounts: [62.92, 243.72],
    sellerNip: '5261009959',
    note: 'two Castorama paragony, one with struck-through lines (expense #2963)',
  },
  {
    file: 'IMG_3470.JPG',
    amounts: [72.68],
    sellerNip: '5261009959',
    note: 'one paragon; the corner of another peeks in at the edge (expense #2168)',
  },
  {
    file: 'IMG_5357-52a724.PNG',
    amounts: [653.24],
    sellerNip: '5361097644',
    note: 'one invoice confirmation on top of a stack of others (expense #4059)',
  },
  {
    file: 'WhatsApp-Image-2026-08-19-at-14.15.02-3-af32de.jpeg',
    amounts: [115.18, 170.96, 105.17, 216.01, 15.41, 249.73, 63.77],
    sellerNip: '5261009959',
    note: 'seven Castorama paragony in two rows',
  },
  {
    file: 'WhatsApp-Image-2026-05-05-at-14.08.15.jpeg',
    amounts: [113.36, 89.96, 236.56, 10.99],
    note: 'three Castorama paragony and a small one from another shop',
  },
  {
    file: 'WhatsApp-Image-2026-06-26-at-16.17.20.jpeg',
    amounts: [607.86, 142.95, 242.78, 191.88, 279.5, 70.92],
    note: 'six documents from OBI, Leroy Merlin, Castorama and Circle K',
  },
  {
    file: 'WhatsApp-Image-2026-05-28-at-11.31.17.jpeg',
    amounts: [202, 68.97],
    note: 'a Ryżko sale confirmation, a Topaz paragon and the card-terminal slip paying the first',
  },
  {
    file: 'WhatsApp-Image-2026-05-26-at-07.06.32.jpeg',
    amounts: [93.51],
    sellerNip: '1130089950',
    note: 'one Leroy Merlin paragon; a card-terminal slip peeks in at the corner',
  },
  {
    file: 'WhatsApp-Image-2026-04-21-at-13.13.24.jpeg',
    amounts: [130.95],
    sellerNip: '1132568413',
    note: 'one Bricoman sale confirmation',
  },
]
