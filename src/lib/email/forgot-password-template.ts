const BRAND_COLOR = '#1a1a1a'
const BG_COLOR = '#fafafa'
const TEXT_COLOR = '#333333'
const MUTED_COLOR = '#666666'

export function forgotPasswordEmailHTML({ token, userName }: { token: string; userName?: string }) {
  const resetUrl = `${process.env.NEXT_PUBLIC_FRONTEND_URL}/zaloguj/reset-hasla?token=${token}`
  const greeting = userName ? `Cześć ${userName},` : 'Cześć,'

  return `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_COLOR};padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background-color:${BRAND_COLOR};padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Wykonczymy</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:${TEXT_COLOR};font-size:16px;line-height:1.5;">${greeting}</p>
          <p style="margin:0 0 24px;color:${TEXT_COLOR};font-size:16px;line-height:1.5;">Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta. Kliknij przycisk poniżej, aby ustawić nowe hasło.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
            <tr><td style="background-color:${BRAND_COLOR};border-radius:6px;">
              <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:12px 32px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">Zresetuj hasło</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:${MUTED_COLOR};font-size:14px;line-height:1.5;">Link wygasa za 1 godzinę.</p>
          <p style="margin:0;color:${MUTED_COLOR};font-size:14px;line-height:1.5;">Jeśli to nie Ty wysłałeś tę prośbę, zignoruj tę wiadomość.</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #eeeeee;">
          <p style="margin:0;color:${MUTED_COLOR};font-size:12px;text-align:center;">© ${new Date().getFullYear()} Wykonczymy</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
