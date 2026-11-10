/**
 * Vaultix Enterprise Transactional Email Template 2.0 (Unified Left-Aligned Enterprise Grid)
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
      <!-- Action Button (Bulletproof VML for Outlook + Left-Aligned Modern CSS) -->
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 20px;width:100%">
        <tr>
          <td align="left">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${buttonUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="20%" stroke="f" fillcolor="${conf.primary}">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:14px;font-weight:700;">${buttonText}</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <a href="${buttonUrl}" target="_blank" style="display:inline-block;padding:13px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background-color:${conf.primary};letter-spacing:0.2px;box-shadow:0 4px 14px ${conf.shadow};">
              ${buttonText}
            </a>
            <!--<![endif]-->
          </td>
        </tr>
      </table>

      <!-- Secondary Clean URL Fallback Box -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 4px;padding-top:16px;border-top:1px solid #f1f5f9">
        <tr>
          <td align="left" style="padding:0">
            <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:600;color:#64748b;line-height:1.4">
              Button not working? Paste this link into your browser:
            </p>
            <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-family:'SF Mono',Consolas,Menlo,monospace;font-size:11px;line-height:1.5;color:#0284c7;word-break:break-all;overflow-wrap:anywhere">
              <a href="${buttonUrl}" style="color:#0284c7;text-decoration:none;word-break:break-all">${buttonUrl}</a>
            </div>
          </td>
        </tr>
      </table>
    `
    : '';

  const securityNotice = footerNote
    ? `
      <!-- Security Callout Notice (Clean Left-Aligned) -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;border-top:1px solid #f1f5f9;padding-top:16px">
        <tr>
          <td style="vertical-align:top;width:24px;padding-right:10px">
            <div style="width:22px;height:22px;border-radius:6px;background-color:#f8fafc;border:1px solid #e2e8f0;text-align:center;line-height:20px;font-size:11px">
              🔒
            </div>
          </td>
          <td style="vertical-align:middle" align="left">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11.5px;line-height:1.6;color:#64748b">
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
      .card-body { padding: 24px 20px 20px !important; }
      .brand-logo { width: 145px !important; max-width: 145px !important; }
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
        
        <!-- Header: Official Application Logo (Aligned with Card Width) -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-container" style="max-width:580px;margin-bottom:20px">
          <tr>
            <td align="left" style="padding:0">
              <a href="${appUrl}" target="_blank" style="text-decoration:none;display:inline-block">
                <img src="${brandLogoSrc}" alt="Vaultix" class="brand-logo" width="160" style="display:block;width:160px;max-width:160px;height:auto;border:0;outline:none;text-decoration:none" />
              </a>
            </td>
            <td align="right" style="vertical-align:middle;padding:0">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:0.3px">
                Zero-Knowledge Security
              </span>
            </td>
          </tr>
        </table>

        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff" class="email-container" style="max-width:580px;background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 10px 25px -5px rgba(15,23,42,0.06);overflow:hidden">
          
          <!-- Integrated Subheader: Badge Row with Clean Divider -->
          <tr>
            <td bgcolor="#fafbfc" style="padding:18px 32px 14px;border-bottom:1px solid #f1f5f9;background-color:#fafbfc">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td bgcolor="${conf.badgeBg}" style="background-color:${conf.badgeBg};border:1px solid ${conf.badgeBorder};border-radius:9999px;padding:4px 12px">
                          <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:10.5px;font-weight:700;color:${conf.badgeText};letter-spacing:0.8px;text-transform:uppercase">
                            ${iconEmoji}&nbsp; ${badgeLabel}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#94a3b8;font-weight:500">
                    Vaultix Enterprise
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Content Body (Strict Left-Aligned) -->
          <tr>
            <td class="card-body" align="left" style="padding:32px 32px 28px;text-align:left">
              
              <!-- Main Heading -->
              <h1 style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;font-weight:800;line-height:1.35;color:#0f172a;letter-spacing:-0.4px;text-align:left">
                ${title}
              </h1>

              <!-- Message Body -->
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.65;color:#334155;margin:0;text-align:left">
                ${body}
              </div>

              <!-- Extra Content (Recovery Key Box, Verification Codes, Callouts) -->
              ${extraHtml}

              <!-- Action Button & Fallback (Strict Left-Aligned) -->
              ${buttonSection}

              <!-- Security Callout Notice -->
              ${securityNotice}

            </td>
          </tr>
        </table>

        <!-- Modern Security & Legal Footer (Aligned with Card Margin) -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-container" style="max-width:580px;margin-top:22px">
          <tr>
            <td align="left" style="padding:0 4px">
              <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11.5px;color:#64748b;line-height:1.5">
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
