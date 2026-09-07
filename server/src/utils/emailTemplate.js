// Shared, email-client-safe HTML layout for all Vaultix transactional mail.
// Everything is inline-styled (no external CSS / <style> blocks) so it renders
// consistently in Gmail, Outlook and mobile clients.

const ACCENTS = {
  blue: '#2563eb',
  indigo: '#4f46e5',
  purple: '#7c3aed',
  emerald: '#059669',
};

const brandMark = `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:28px">
    <tr>
      <td align="center" style="padding:0">
        <span style="font-family:'Segoe UI',Arial,sans-serif;font-size:26px;font-weight:700;color:#0f172a;letter-spacing:0.5px">
          <span style="color:${ACCENTS.blue}">V</span>aultix
        </span>
      </td>
    </tr>
  </table>
`;

const wrapperOpen = `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f3f4f8" style="background-color:#f3f4f8;padding:32px 12px">
    <tr>
      <td align="center" style="padding:0">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:16px;border:1px solid #e5e7eb;box-shadow:0 8px 24px rgba(15,23,42,0.08)">
          <tr>
            <td style="padding:36px 40px 12px" bgcolor="#ffffff">
`;

const wrapperClose = `
            </td>
          </tr>
        </table>
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px">
          <tr>
            <td align="center" style="padding:20px 24px 8px">
              <p style="margin:0;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;line-height:1.6;color:#94a3b8">
                Secured with end-to-end AES-256 encryption<br/>
                &copy; ${new Date().getFullYear()} Vaultix &middot; All rights reserved
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
`;

function renderEmail({ title, body, buttonText, buttonUrl, accent = 'blue', footerNote, extraHtml = '' }) {
  const color = ACCENTS[accent] || ACCENTS.blue;

  const button = buttonText && buttonUrl
    ? `
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 24px">
        <tr>
          <td align="center" bgcolor="${color}" style="border-radius:10px;background-color:${color}">
            <a href="${buttonUrl}" style="display:inline-block;font-family:'Segoe UI',Arial,sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:10px">${buttonText}</a>
          </td>
        </tr>
      </table>
    `
    : '';

  const note = footerNote
    ? `<p style="margin:0;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;line-height:1.6;color:#94a3b8">${footerNote}</p>`
    : '';

  return `
    ${wrapperOpen}
      ${brandMark}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-left:4px solid ${color};background-color:#f8fafc;border-radius:8px">
        <tr>
          <td style="padding:18px 20px">
            <h1 style="margin:0;font-family:'Segoe UI',Arial,sans-serif;font-size:22px;font-weight:700;color:#0f172a">${title}</h1>
          </td>
        </tr>
      </table>
      <p style="margin:22px 0 0;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.7;color:#475569">${body}</p>
      ${button}
      ${extraHtml}
    ${wrapperClose}
  `;
}

module.exports = { renderEmail };