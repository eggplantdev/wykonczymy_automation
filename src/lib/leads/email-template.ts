// Branded HTML email shell — logo header + card body, all inline styles so it
// survives Gmail/Outlook (which strip <style> and don't support inline <svg>).
// The logo is referenced by ABSOLUTE URL: email clients can't resolve relative
// paths, and remote-image blocking is covered by the alt text.

// Palette lifted from the app icon (house + toolbox).
const BRAND = {
  navy: '#1c4257',
  cream: '#f4efe4',
  pageBg: '#eef1f3',
  cardBg: '#ffffff',
  text: '#2b2f33',
  muted: '#6b7280',
  border: '#e2e5e8',
} as const

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

type BrandedEmailT = {
  logoUrl: string
  heading: string
  /** Plain-text paragraphs; escaped and rendered in order. */
  paragraphs: string[]
  /** Small print under a divider (e.g. "automatic reply"). Optional. */
  footer?: string
}

export function renderBrandedEmail({
  logoUrl,
  heading,
  paragraphs,
  footer,
}: BrandedEmailT): string {
  const body = paragraphs
    .map(
      (text) =>
        `<p style="color:${BRAND.text};font-size:15px;line-height:1.7;margin:0 0 16px 0;">${escapeHtml(text)}</p>`,
    )
    .join('\n')

  const footerHtml = footer
    ? `<hr style="border:none;border-top:1px solid ${BRAND.border};margin:24px 0 16px 0;" />
       <p style="color:${BRAND.muted};font-size:12px;line-height:1.6;text-align:center;margin:0;">${escapeHtml(footer)}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="background-color:${BRAND.pageBg};margin:0;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background-color:${BRAND.cardBg};border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
      <div style="background-color:${BRAND.cream};text-align:center;padding:28px 32px 20px 32px;">
        <img src="${logoUrl}" alt="Wykończymy" width="72" height="72" style="display:inline-block;border:0;outline:none;" />
      </div>
      <div style="padding:32px;">
        <h1 style="color:${BRAND.navy};font-size:22px;font-weight:600;margin:0 0 20px 0;">${escapeHtml(heading)}</h1>
        ${body}
        ${footerHtml}
      </div>
    </div>
  </body>
</html>`
}
