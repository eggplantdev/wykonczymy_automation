export function printViaIframe(html: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.width = '0'
  iframe.style.height = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document
  if (!doc) {
    iframe.remove()
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  // Wait for content to render before printing
  iframe.contentWindow?.addEventListener('afterprint', () => iframe.remove())

  // Small delay to ensure styles are applied
  setTimeout(() => {
    iframe.contentWindow?.print()
  }, 100)
}
