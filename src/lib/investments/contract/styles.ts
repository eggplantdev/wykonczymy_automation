import { PRINT_DOCUMENT_BASE_STYLES } from '@/lib/utils/print-document-styles'

export const CONTRACT_PRINT_STYLES = `${PRINT_DOCUMENT_BASE_STYLES}
body { font-size: 10pt; text-align: justify; }
h1 .fill { min-width: 30mm; text-align: center; }
h2 { text-align: center; margin-top: 18px; }
.party { margin: 8px 0; }
.connector { text-align: center; font-weight: 700; margin: 10px 0; }

.point, .subpoint { display: flex; gap: 6px; margin: 3px 0; }
.point > .n, .subpoint > .n { flex: none; width: 6mm; }
.point .fill { min-width: 30mm; }
`
