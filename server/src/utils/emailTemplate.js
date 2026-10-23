/**
 * Vaultix Enterprise Transactional Email Template
 * 
 * High-contrast, responsive HTML email layout built for 100% fidelity across:
 * - Microsoft Outlook (Desktop 2016-2024, Web 365, iOS, Android, Mac)
 * - Gmail (Web, iOS app, Android app)
 * - Apple Mail (macOS & iOS)
 * - Thunderbird, Samsung Mail, Yahoo Mail
 * 
 * Design Features:
 * - Official Vaultix application logo lockup (embedded via CID attachment & hosted fallback)
 * - Cohesive brand palette (Vaultix Royal Blue, Indigo, Emerald Security)
 * - Rounded container card with integrated top accent line
 * - Styled pill badges with crisp metadata labels
 * - Bulletproof VML + CSS call-to-action buttons for Microsoft Outlook
 * - High-security monospace cryptographic recovery key card
 * - Enterprise security callouts and audit footer
 */

const { clientUrl } = require('./clientUrl');

const ACCENTS = {
  purple: {
    primary: '#6366f1',
    gradientFrom: '#4f46e5',
    gradientTo: '#6366f1',
    lightBg: '#f5f3ff',
    badgeBg: '#eef2ff',
    badgeBorder: '#c7d2fe',
    badgeText: '#4338ca',
    shadow: 'rgba(99, 102, 241, 0.28)',
    icon: '🤝',
    defaultBadge: 'TEAM INVITATION',
  },
  blue: {
    primary: '#0062ff',
    gradientFrom: '#0052d9',
    gradientTo: '#0066ff',
    lightBg: '#eff6ff',
    badgeBg: '#eff6ff',
    badgeBorder: '#bfdbfe',
    badgeText: '#1d4ed8',
    shadow: 'rgba(0, 98, 255, 0.28)',
    icon: '🛡️',
    defaultBadge: 'EMAIL VERIFICATION',
  },
  indigo: {
    primary: '#4f46e5',
    gradientFrom: '#3730a3',
    gradientTo: '#4f46e5',
    lightBg: '#eef2ff',
    badgeBg: '#e0e7ff',
    badgeBorder: '#c7d2fe',
    badgeText: '#3730a3',
    shadow: 'rgba(79, 70, 229, 0.28)',
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
    shadow: 'rgba(5, 150, 105, 0.28)',
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
    shadow: 'rgba(217, 119, 6, 0.28)',
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
}) {
  const conf = ACCENTS[accent] || ACCENTS.blue;
  const badgeLabel = badge || conf.defaultBadge;
  const iconEmoji = icon || conf.icon;
  const snippet = previewText || (body ? body.replace(/<[^>]*>/g, '').slice(0, 120) : title);
  const currentYear = new Date().getFullYear();
  const brandLogoSrc = logoUrl || 'cid:vaultix-logo';
  const appUrl = clientUrl || 'https://vaultix.knadvisors.pro';

  const buttonSection = buttonText && buttonUrl
    ? `
      <!-- Action Button (Bulletproof for Outlook + Modern Clients) -->
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 16px">
        <tr>
          <td align="center" bgcolor="${conf.primary}" style="background-color:${conf.primary};border-radius:10px;box-shadow:0 4px 14px ${conf.shadow}">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${buttonUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="20%" stroke="f" fillcolor="${conf.primary}">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:Segoe UI, sans-serif;font-size:15px;font-weight:600;">${buttonText}</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <a href="${buttonUrl}" target="_blank" style="display:inline-block;padding:14px 34px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background-color:${conf.primary};letter-spacing:0.2px">
              ${buttonText}
            </a>
            <!--<![endif]-->
          </td>
        </tr>
      </table>

      <!-- Secondary URL fallback box -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 4px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px">
        <tr>
          <td style="padding:14px 18px">
            <p style="margin:0 0 5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.6px">
              Button not working? Use this direct link:
            </p>
            <p style="margin:0;font-family:Consolas,Menlo,Monaco,monospace;font-size:12px;line-height:1.55;color:#0284c7;word-break:break-all">
              <a href="${buttonUrl}" style="color:#0284c7;text-decoration:none">${buttonUrl}</a>
            </p>
          </td>
        </tr>
      </table>
    `
    : '';

  const securityNotice = footerNote
    ? `
      <!-- Security Callout -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border-top:1px solid #f1f5f9;padding-top:18px">
        <tr>
          <td style="vertical-align:top;width:24px;padding-right:12px">
            <div style="width:24px;height:24px;border-radius:6px;background-color:#f1f5f9;text-align:center;line-height:24px;font-size:13px">🔒</div>
          </td>
          <td style="vertical-align:middle">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#64748b">
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
      .brand-logo { width: 150px !important; max-width: 150px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%">
  <!-- Hidden preheader snippet for inbox preview -->
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all">
    ${snippet} &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <!-- Main Canvas Wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f8fafc" style="background-color:#f8fafc;padding:36px 16px 48px">
    <tr>
      <td align="center" style="padding:0">
        
        <!-- Header: Official Application Logo -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-container" style="max-width:560px;margin-bottom:24px">
          <tr>
            <td align="center" style="padding:0">
              <a href="${appUrl}" target="_blank" style="text-decoration:none;display:inline-block">
                <img src="${brandLogoSrc}" alt="Vaultix" class="brand-logo" width="180" style="display:block;width:180px;max-width:180px;height:auto;border:0;outline:none;text-decoration:none;margin:0 auto" />
              </a>
            </td>
          </tr>
        </table>

        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff" class="email-container" style="max-width:560px;background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 10px 25px -5px rgba(15,23,42,0.06), 0 8px 10px -6px rgba(15,23,42,0.04);overflow:hidden">
          
          <!-- Top Card Accent Strip -->
          <tr>
            <td bgcolor="${conf.primary}" style="height:4px;background-color:${conf.primary};border-top-left-radius:16px;border-top-right-radius:16px;line-height:4px;font-size:1px">
              &nbsp;
            </td>
          </tr>

          <!-- Card Content Body -->
          <tr>
            <td class="card-body" style="padding:36px 38px 32px">
              
              <!-- Badge & Icon Row -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:18px">
                <tr>
                  <td>
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td bgcolor="${conf.badgeBg}" style="background-color:${conf.badgeBg};border:1px solid ${conf.badgeBorder};border-radius:9999px;padding:5px 14px">
                          <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:${conf.badgeText};letter-spacing:0.8px;text-transform:uppercase">
                            ${iconEmoji}&nbsp; ${badgeLabel}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <h1 style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:23px;font-weight:700;line-height:1.35;color:#0f172a;letter-spacing:-0.4px">
                ${title}
              </h1>

              <!-- Message Body -->
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#334155;margin:0">
                ${body}
              </div>

              <!-- Extra HTML (Recovery Key Box, Custom Elements, etc.) -->
              ${extraHtml}

              <!-- Action Button & Direct Link -->
              ${buttonSection}

              <!-- Security Notice -->
              ${securityNotice}

            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-container" style="max-width:560px;margin-top:26px">
          <tr>
            <td align="center" style="padding:0 20px">
              <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#64748b;line-height:1.5">
                Sent by <strong style="color:#334155">Vaultix Enterprise</strong> &middot; <a href="${appUrl}" target="_blank" style="color:#2563eb;text-decoration:none;font-weight:500">vaultix.knadvisors.pro</a>
              </p>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:#94a3b8;line-height:1.5">
                End-to-End Encrypted with AES-256-GCM &middot; &copy; ${currentYear} Vaultix. All rights reserved.
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