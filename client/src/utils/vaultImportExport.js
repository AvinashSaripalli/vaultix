import * as XLSX from 'xlsx';

export const IMPORT_FORMATS = ['csv', 'xlsx', 'xls', 'json', 'bitwarden', 'keepass'];

function detectCsvSource(rawRows) {
  if (!rawRows?.length) return 'generic';
  const first = rawRows[0] || {};
  const hasTitle = 'Title' in first;
  const hasUsername = 'Username' in first;
  if (hasTitle && hasUsername) return 'keepass-csv';
  return 'generic';
}

export function detectFileFormat(file) {
  const name = (file?.name || '').toLowerCase();

  if (name.endsWith('.csv')) return 'csv';
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return file.type.includes('excel') ? 'excel' : 'excel';
  if (name.endsWith('.json')) return 'json';

  // Bitwarden export is a JSON file
  if (file?.type === 'application/json') return 'json';

  // KeePass is a complex XML-based format (KDBX/KDB). We detect by extension.
  if (name.endsWith('.kdbx') || name.endsWith('.kdb')) return 'keepass';

  return 'unknown';
}

export async function parseImportFile(file) {
  const format = detectFileFormat(file);

  if (format === 'csv' || format === 'excel') {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    // Normalize KeePass CSV columns (Title, Username, Password, URL, Notes,
    // Group) and any other common aliases into our canonical Name/Login/etc.
    // Extra columns are preserved (spread) so typed items (SSH_KEY, CARD, ...)
    // carry their field columns through to the encryption step.
    const normalized = rawRows.map((r) => ({
      ...r,
      Name: r.Name || r.name || r.Title || r.title || '',
      Login: r.Login || r.login || r.Username || r.username || r.UserName || '',
      Password: r.Password || r.password || '',
      URL: r.URL || r.Url || r.url || r.URI || r.uri || '',
      Note: r.Note || r.note || r.Notes || r.notes || '',
      Tags: r.Tags || r.tags || r.Group || r.group || '',
      Type: r.Type || r.type || 'LOGIN',
    }));

    return {
      rows: normalized,
      format,
      detectedSource: format === 'csv' ? detectCsvSource(rawRows) : 'excel',
    };
  }

  if (format === 'json') {
    const text = await file.text();
    const data = JSON.parse(text);

    // Bitwarden format
    if (data && (Array.isArray(data.items) || data.encrypted !== undefined || data.items)) {
      // Bitwarden item types: 1=Login, 2=SecureNote, 3=Card, 4=Identity.
      const BITWARDEN_TYPE_MAP = {
        1: 'LOGIN',
        2: 'SECURE_NOTE',
        3: 'CARD',
        4: 'IDENTITY',
      };

      const bitwardenRows = (data.items || [])
        .map((item) => {
          const itemType = BITWARDEN_TYPE_MAP[item.type] || (item.login?.password ? 'LOGIN' : item.secureNote ? 'SECURE_NOTE' : 'LOGIN');
          const typed = { ...(item.fields || []) };
          if (itemType === 'CARD' && item.card) {
            if (item.card.cardholderName) typed.cardholderName = item.card.cardholderName;
            if (item.card.number) typed.cardNumber = item.card.number;
            if (item.card.brand) typed.brand = item.card.brand;
            if (item.card.expMonth && item.card.expYear) typed.expiry = `${String(item.card.expMonth).padStart(2, '0')}/${String(item.card.expYear).slice(-2)}`;
            if (item.card.code) typed.cvv = item.card.code;
          }
          if (itemType === 'IDENTITY' && item.identity) {
            if (item.identity.firstName) typed.firstName = item.identity.firstName;
            if (item.identity.lastName) typed.lastName = item.identity.lastName;
            if (item.identity.email) typed.email = item.identity.email;
            if (item.identity.phone) typed.phone = item.identity.phone;
            if (item.identity.address1) typed.address1 = item.identity.address1;
            if (item.identity.city) typed.city = item.identity.city;
            if (item.identity.state) typed.state = item.identity.state;
            if (item.identity.postalCode) typed.postalCode = item.identity.postalCode;
            if (item.identity.country) typed.country = item.identity.country;
          }
          return {
            ...typed,
            Name: item.name || '',
            Login: item.login?.username || item.username || '',
            Password: item.login?.password || '',
            URL: item.login?.uris?.[0]?.uri || item.login?.uri || item.uri || '',
            Note: item.notes || item.secureNote?.notes || '',
            Tags: (item.collectionIds || []).join(', ') || '',
            Type: itemType,
          };
        })
        .filter((item) => item.Name || item.Password || Object.keys(item).length > 7);
      return { rows: bitwardenRows, format: 'bitwarden' };
    }

    // Generic array of objects { name, login, password, url, note }
    if (Array.isArray(data)) {
      return {
        rows: data.map((r) => ({
          ...r,
          Name: r.name || r.Name || '',
          Login: r.login || r.Login || r.username || r.Username || '',
          Password: r.password || r.Password || '',
          URL: r.url || r.URL || r.Url || '',
          Note: r.note || r.Note || r.notes || r.Notes || '',
          Tags: r.tags || r.Tags || '',
          Type: r.Type || r.type || 'LOGIN',
        })),
        format: 'json',
      };
    }

    return { rows: [], format };
  }

  if (format === 'keepass') {
    // KeePass KDBX files are binary/XML archives that require the database
    // password to decrypt. Without a full KDBX parser on the client, we
    // provide guidance. For KeePass users, recommend using the KeePass
    // built-in "Export > CSV" then import that CSV for full security.
    throw new Error(
      'Direct KeePass KDBX import is not supported for security reasons. ' +
      'Please export your KeePass database to CSV (File > Export > CSV) and import that file instead.'
    );
  }

  return { rows: [], format };
}

// Convert decrypted internal rows into the requested export format string.
export function buildExportContent(rows, format) {
  if (format === 'csv') {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    return { content: csv, mime: 'text/csv', ext: 'csv' };
  }

  if (format === 'excel') {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Passwords');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    return { content: buffer, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx', isBuffer: true };
  }

  if (format === 'bitwarden') {
    const bitwarden = {
      encrypted: false,
      folders: [],
      items: rows.map((r) => ({
        id: `${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 12)}`,
        organizationId: null,
        folderId: null,
        type: 1,
        reprompt: 0,
        name: r.Name || '',
        notes: r.Note || null,
        favorite: false,
        login: {
          uris: r.URL ? [{ match: null, uri: r.URL }] : [],
          username: r.Login || '',
          password: r.Password || '',
        },
        collectionIds: [],
      })),
    };
    return { content: JSON.stringify(bitwarden, null, 2), mime: 'application/json', ext: 'json', isBuffer: false };
  }

  if (format === 'json') {
    return {
      content: JSON.stringify(rows, null, 2),
      mime: 'application/json',
      ext: 'json',
      isBuffer: false,
    };
  }

  return { content: '', mime: 'text/plain', ext: 'txt', isBuffer: false };
}

export function downloadExport(rows, format, filenameBase) {
  const { content, mime, ext, isBuffer } = buildExportContent(rows, format);
  if (!content) return;

  const blob = isBuffer
    ? new Blob([content], { type: mime })
    : new Blob([content], { type: mime || 'text/plain' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenameBase}.${ext}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
