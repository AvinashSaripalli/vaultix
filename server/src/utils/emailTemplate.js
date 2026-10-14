/**
 * Vaultix Enterprise Transactional Email Template
 * 
 * Bulletproof, high-contrast HTML layout designed for 100% compatibility across:
 * - Microsoft Outlook (Desktop 2016-2024, Web Outlook 365, Mac)
 * - Gmail (Web, iOS app, Android app)
 * - Apple Mail (macOS & iOS)
 * - Thunderbird, Samsung Mail, Yahoo
 * 
 * Features:
 * - Hidden inbox preheader snippet for high-open-rate preview text
 * - Modern Vaultix shield logo & brand lockup
 * - Purpose-driven accent themes (purple = invite, blue = verify, indigo = reset, emerald = recovery)
 * - Category pill badges with iconic glyphs
 * - Bulletproof VML + HTML call-to-action buttons
 * - Secondary copyable URL fallback for enterprise spam filters
 * - Cryptographic zero-knowledge security notice
 * - Sleek, lightweight footer with automatic copyright year
 */

const ACCENTS = {
  purple: {
    primary: '#7c3aed',
    gradientFrom: '#6d28d9',
    gradientTo: '#8b5cf6',
    lightBg: '#f5f3ff',
    badgeBg: '#f3e8ff',
    badgeBorder: '#e9d5ff',
    badgeText: '#7e22ce',
    shadow: 'rgba(124, 58, 237, 0.25)',
    icon: '🤝',
    defaultBadge: 'TEAM INVITATION',
  },
  blue: {
    primary: '#2563eb',
    gradientFrom: '#1d4ed8',
    gradientTo: '#3b82f6',
    lightBg: '#eff6ff',
    badgeBg: '#dbeafe',
    badgeBorder: '#bfdbfe',
    badgeText: '#1e40af',
    shadow: 'rgba(37, 99, 235, 0.25)',
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
    badgeBg: '#d1fae5',
    badgeBorder: '#a7f3d0',
    badgeText: '#065f46',
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
}) {
  const conf = ACCENTS[accent] || ACCENTS.blue;
  const badgeLabel = badge || conf.defaultBadge;
  const iconEmoji = icon || conf.icon;
  const snippet = previewText || (body ? body.replace(/<[^>]*>/g, '').slice(0, 120) : title);
  const currentYear = new Date().getFullYear();

  const buttonSection = buttonText && buttonUrl
    ? `
      <!-- Action Button (Bulletproof for Outlook + Modern Clients) -->
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 16px">
        <tr>
          <td align="center" bgcolor="${conf.primary}" style="background-color:${conf.primary};border-radius:10px;box-shadow:0 4px 14px ${conf.shadow}">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${buttonUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="20%" stroke="f" fillcolor="${conf.primary}">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:Segoe UI, sans-serif;font-size:15px;font-weight:600;">${buttonText} &rarr;</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <a href="${buttonUrl}" target="_blank" style="display:inline-block;padding:14px 34px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.2px">
              ${buttonText} &nbsp;&rarr;
            </a>
            <!--<![endif]-->
          </td>
        </tr>
      </table>

      <!-- Secondary URL fallback box -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 4px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
        <tr>
          <td style="padding:12px 16px">
            <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">
              Button not working? Use this direct link:
            </p>
            <p style="margin:0;font-family:Consolas,Menlo,Monaco,monospace;font-size:12px;line-height:1.5;color:#0284c7;word-break:break-all">
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
          <td style="vertical-align:top;width:24px;padding-right:10px">
            <span style="font-size:15px;line-height:1">🔒</span>
          </td>
          <td style="vertical-align:top">
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
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%">
  <!-- Hidden preheader snippet for inbox preview -->
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all">
    ${snippet} &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <!-- Decorative top line -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${conf.primary}" style="height:4px;background-color:${conf.primary}">
    <tr><td style="height:4px;line-height:4px;font-size:1px">&nbsp;</td></tr>
  </table>

  <!-- Main Canvas Wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f1f5f9" style="background-color:#f1f5f9;padding:36px 16px 44px">
    <tr>
      <td align="center" style="padding:0">
        
        <!-- Header: Brand Logo & Title -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;margin-bottom:22px">
          <tr>
            <td align="center">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td bgcolor="#0f172a" style="background-color:#0f172a;width:38px;height:38px;border-radius:10px;text-align:center;vertical-align:middle;box-shadow:0 3px 8px rgba(15,23,42,0.18)">
                          <span style="font-size:18px;line-height:38px;display:block">🛡️</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="vertical-align:middle;text-align:left">
                    <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:0.5px">
                      VAULT<span style="color:${conf.primary}">IX</span>
                    </span>
                    <span style="display:block;font-size:10px;font-weight:600;letter-spacing:1px;color:#94a3b8;text-transform:uppercase">
                      Zero-Knowledge Vault
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="max-width:580px;background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 10px 25px -5px rgba(15,23,42,0.06), 0 8px 10px -6px rgba(15,23,42,0.04);overflow:hidden">
          
          <!-- Top Card Accent Strip -->
          <tr>
            <td bgcolor="${conf.primary}" style="height:4px;background-color:${conf.primary};line-height:4px;font-size:1px">
              &nbsp;
            </td>
          </tr>

          <!-- Card Content Body -->
          <tr>
            <td style="padding:34px 34px 30px">
              
              <!-- Badge & Icon Row -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:18px">
                <tr>
                  <td>
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td bgcolor="${conf.badgeBg}" style="background-color:${conf.badgeBg};border:1px solid ${conf.badgeBorder};border-radius:20px;padding:5px 12px">
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
              <h1 style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;line-height:1.3;color:#0f172a;letter-spacing:-0.4px">
                ${title}
              </h1>

              <!-- Message Body -->
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#334155">
                ${body}
              </div>

              <!-- Extra HTML (Recovery Key Box, Tables, etc.) -->
              ${extraHtml}

              <!-- Action Button & Direct Link -->
              ${buttonSection}

              <!-- Security Notice -->
              ${securityNotice}

            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;margin-top:24px">
          <tr>
            <td align="center" style="padding:0 20px">
              <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#64748b;line-height:1.5">
                Sent by <strong style="color:#475569">Vaultix Enterprise</strong> &middot; <a href="https://vaultix.knadvisors.pro" style="color:#475569;text-decoration:none;font-weight:500">vaultix.knadvisors.pro</a>
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