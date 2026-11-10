/**
 * Vaultix Enterprise Transactional Email Template 2.0
 * 
 * Bulletproof, high-contrast, responsive HTML email layout built for 100% fidelity across:
 * - Microsoft Outlook (Desktop 2016-2024, Web 365, iOS, Android, Mac)
 * - Gmail (Web, iOS app, Android app)
 * - Apple Mail (macOS & iOS)
 * - Thunderbird, Samsung Mail, Yahoo Mail
 */

const { clientUrl } = require('./clientUrl');

const ACCENTS = {
  purple: {
    primary: '#7c3aed',
    gradientFrom: '#6366f1',
    gradientTo: '#8b5cf6',
    lightBg: '#faf5ff',
    badgeBg: '#f3e8ff',
    badgeBorder: '#d8b4fe',
    badgeText: '#6b21a8',
    shadow: 'rgba(124, 58, 237, 0.25)',
    icon: '🤝',
    defaultBadge: 'TEAM INVITATION',
  },
  blue: {
    primary: '#0284c7',
    gradientFrom: '#0284c7',
    gradientTo: '#2563eb',
    lightBg: '#f0f9ff',
    badgeBg: '#e0f2fe',
    badgeBorder: '#bae6fd',
    badgeText: '#0369a1',
    shadow: 'rgba(2, 132, 199, 0.25)',
    icon: '🛡️',
    defaultBadge: 'EMAIL VERIFICATION',
  },
  indigo: {
    primary: '#4f46e5',
    gradientFrom: '#4338ca',
    gradientTo: '#6366f1',
    lightBg: '#eef2ff',
    badgeBg: '#e0e7ff',
    badgeBorder: '#c7d2fe',
    badgeText: '#3730a3',
    shadow: 'rgba(79, 70, 229, 0.25)',
    icon: '🔑',
    defaultBadge: 'PASSWORD RESET',
  },
  emerald: {
    primary: '#059669',
    gradientFrom: '#047857',
    gradientTo: '#10b981',
    lightBg: '#ecfdf5',
    badgeBg: '#dcfce7',
    badgeBorder: '#86efac',
    badgeText: '#15803d',
    shadow: 'rgba(5, 150, 105, 0.25)',
    icon: '🔐',
    defaultBadge: 'MASTER RECOVERY KEY',
  },
  amber: {
    primary: '#d97706',
    gradientFrom: '#b45309',
    gradientTo: '#f59e0b',
    lightBg: '#fffbeb',
    badgeBg: '#fef3c7',
    badgeBorder: '#fde68a',
    badgeText: '#92400e',
    shadow: 'rgba(217, 119, 6, 0.25)',
    icon: '⚠️',
    defaultBadge: 'SECURITY NOTICE',
  },
};

function renderEmail({
  title,
  body,
  buttonText,
  buttonUrl,
  accent = 'blue',
  badge,
  icon,
  previewText,
  footerNote,
  extraHtml = '',
  logoUrl,
  recipientEmail,
}) {
  const conf = ACCENTS[accent] || ACCENTS.blue;
  const badgeLabel = badge || conf.defaultBadge;
  const iconEmoji = icon || conf.icon;
  const snippet = previewText || (body ? body.replace(/<[^>]*>/g, '').slice(0, 130) : title);
  const currentYear = new Date().getFullYear();
  const brandLogoSrc = logoUrl || 'cid:vaultix-logo';
  const appUrl = clientUrl || 'https://vaultix.knadvisors.pro';

  const buttonSection = buttonText && buttonUrl
    ? `
      <!-- Action Button (Bulletproof VML for Outlook + Modern CSS) -->
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0 16px;width:100%">
        <tr>
          <td align="center">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${buttonUrl}" style="height:50px;v-text-anchor:middle;width:280px;" arcsize="20%" stroke="f" fillcolor="${conf.primary}">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:15px;font-weight:700;">${buttonText}</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <a href="${buttonUrl}" target="_blank" style="display:inline-block;padding:14px 38px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;background-color:${conf.primary};letter-spacing:0.2px;box-shadow:0 4px 14px ${conf.shadow};transition:all 0.2s">
              ${buttonText}
            </a>
            <!--<![endif]-->
          </td>
        </tr>
      </table>

      <!-- Secondary URL fallback box -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 4px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
        <tr>
          <td style="padding:12px 16px">
            <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.6px">
              Direct Link Fallback:
            </p>
            <p style="margin:0;font-family:'SF Mono',Consolas,Menlo,Monaco,monospace;font-size:11px;line-height:1.5;color:#0284c7;word-break:break-all">
              <a href="${buttonUrl}" style="color:#0284c7;text-decoration:none">${buttonUrl}</a>
            </p>
          </td>
        </tr>
      </table>
    `
    : '';

  const securityNotice = footerNote
    ? `
      <!-- Security Callout Notice -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px;border-top:1px solid #f1f5f9;padding-top:16px">
        <tr>
          <td style="vertical-align:top;width:26px;padding-right:10px">
            <div style="width:24px;height:24px;border-radius:8px;background-color:#f8fafc;border:1px solid #e2e8f0;text-align:center;line-height:22px;font-size:12px">
              🔒
            </div>
          </td>
          <td style="vertical-align:middle">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.6;color:#64748b">
              ${footerNote}
            </p>
          </td>
        </tr>
      </table>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .card-body { padding: 26px 20px 22px !important; }
      .brand-logo { width: 155px !important; max-width: 155px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%">
  <!-- Hidden preheader preview snippet -->
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all">
    ${snippet} &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <!-- Main Canvas Wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f1f5f9" style="background-color:#f1f5f9;padding:36px 14px 48px">
    <tr>
      <td align="center" style="padding:0">
        
        <!-- Header: Official Application Logo -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-container" style="max-width:580px;margin-bottom:22px">
          <tr>
            <td align="center" style="padding:0">
              <a href="${appUrl}" target="_blank" style="text-decoration:none;display:inline-block">
                <img src="${brandLogoSrc}" alt="Vaultix" class="brand-logo" width="175" style="display:block;width:175px;max-width:175px;height:auto;border:0;outline:none;text-decoration:none;margin:0 auto" />
              </a>
            </td>
          </tr>
        </table>

        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff" class="email-container" style="max-width:580px;background-color:#ffffff;border-radius:18px;border:1px solid #e2e8f0;box-shadow:0 12px 30px -8px rgba(15,23,42,0.08), 0 4px 12px -2px rgba(15,23,42,0.03);overflow:hidden">
          
          <!-- Top Card Accent Gradient Line -->
          <tr>
            <td bgcolor="${conf.primary}" style="height:4px;background-color:${conf.primary};border-top-left-radius:18px;border-top-right-radius:18px;line-height:4px;font-size:1px">
              &nbsp;
            </td>
          </tr>

          <!-- Card Content Body -->
          <tr>
            <td class="card-body" style="padding:36px 36px 32px">
              
              <!-- Badge & Metadata Row -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:18px">
                <tr>
                  <td>
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td bgcolor="${conf.badgeBg}" style="background-color:${conf.badgeBg};border:1px solid ${conf.badgeBorder};border-radius:9999px;padding:5px 14px">
                          <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:10.5px;font-weight:700;color:${conf.badgeText};letter-spacing:0.8px;text-transform:uppercase">
                            ${iconEmoji}&nbsp; ${badgeLabel}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Main Heading -->
              <h1 style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:23px;font-weight:800;line-height:1.35;color:#0f172a;letter-spacing:-0.4px">
                ${title}
              </h1>

              <!-- Message Body -->
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14.5px;line-height:1.65;color:#334155;margin:0">
                ${body}
              </div>

              <!-- Extra Content (Recovery Key Box, Verification Codes, etc.) -->
              ${extraHtml}

              <!-- Action Button & Fallback -->
              ${buttonSection}

              <!-- Security Callout Notice -->
              ${securityNotice}

            </td>
          </tr>
        </table>

        <!-- Modern Security & Legal Footer -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-container" style="max-width:580px;margin-top:24px">
          <tr>
            <td align="center" style="padding:0 20px">
              <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#64748b;line-height:1.5">
                Sent by <strong style="color:#0f172a">Vaultix Enterprise</strong> &middot; <a href="${appUrl}" target="_blank" style="color:#2563eb;text-decoration:none;font-weight:600">vaultix.knadvisors.pro</a>
              </p>
              <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#94a3b8;line-height:1.5">
                Zero-Knowledge Architecture &middot; End-to-End Encrypted with AES-256-GCM &amp; RSA-4096
              </p>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:10.5px;color:#94a3b8;line-height:1.5">
                &copy; ${currentYear} Vaultix. All rights reserved. Do not reply to this automated mailbox.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { renderEmail };
