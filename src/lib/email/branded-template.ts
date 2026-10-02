import { escapeHtml } from '@/lib/utils/escape-html'

// Branded HTML email shell — card body + logo/wordmark footer, all inline styles so it
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

type BrandedEmailT = {
  logoUrl: string
  heading: string
  /** Plain-text paragraphs; escaped and rendered in order. */
  paragraphs: string[]
  /** Rendered after the paragraphs as a button — a styled `<a>`, since clients drop `<button>`. */
  cta?: { label: string; href: string }
  /** Small print under a divider (e.g. "automatic reply"). Optional. */
  footer?: string
}

export function renderBrandedEmail({
  logoUrl,
  heading,
  paragraphs,
  cta,
  footer,
}: BrandedEmailT): string {
  const body = paragraphs
    .map(
      (text) =>
        `<p style="color:${BRAND.text};font-size:15px;line-height:1.7;margin:0 0 16px 0;">${escapeHtml(text).replace(/\n/g, '<br />')}</p>`,
    )
    .join('\n')

  const ctaHtml = cta
    ? `<p style="text-align:center;margin:28px 0 8px 0;">
         <a href="${escapeHtml(cta.href)}" style="display:inline-block;background-color:${BRAND.navy};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">${escapeHtml(cta.label)}</a>
       </p>`
    : ''

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
      <div style="padding:32px;">
        <h1 style="color:${BRAND.navy};font-size:22px;font-weight:600;margin:0 0 20px 0;">${escapeHtml(heading)}</h1>
        ${body}
        ${ctaHtml}
        ${footerHtml}
      </div>
      <div style="background-color:${BRAND.cream};text-align:center;padding:24px 32px;">
        <img src="${logoUrl}" alt="Wykończymy" width="56" height="56" style="display:inline-block;border:0;outline:none;vertical-align:middle;" />
        <div style="color:${BRAND.navy};font-size:16px;font-weight:700;letter-spacing:2px;margin-top:10px;">WYKOŃCZYMY</div>
      </div>
    </div>
  </body>
</html>`
}
