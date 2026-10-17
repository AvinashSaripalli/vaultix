const fs = require('fs');
const path = require('path');
const XLSX = require('../client/node_modules/xlsx');

function convertJsonToVaultixExcel(inputJsonPath, outputExcelPath) {
  if (!fs.existsSync(inputJsonPath)) {
    console.error(`File not found: ${inputJsonPath}`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(inputJsonPath, 'utf8'));
  const passwords = rawData.passwords || (Array.isArray(rawData) ? rawData : []);

  const rows = passwords.map((item) => {
    const fields = item.fields || item;
    const tagsStr = Array.isArray(item.tags)
      ? item.tags.join(', ')
      : (item.tags || fields.tags || '');

    return {
      'Name': fields.name || item.name || '',
      'Type': (item.type || fields.type || 'LOGIN').toUpperCase(),
      'Login': fields.login || fields.username || item.login || item.username || '',
      'Password': fields.password || item.password || '',
      'URL': fields.url || fields.uri || item.url || item.uri || '',
      'Note': fields.note || fields.notes || item.note || item.notes || '',
      'Tags': tagsStr,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set friendly column widths
  worksheet['!cols'] = [
    { wch: 45 }, // Name
    { wch: 10 }, // Type
    { wch: 25 }, // Login
    { wch: 20 }, // Password
    { wch: 50 }, // URL
    { wch: 20 }, // Note
    { wch: 25 }, // Tags
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Passwords');

  XLSX.writeFile(workbook, outputExcelPath);
  console.log(`Successfully converted ${rows.length} entries to ${outputExcelPath}`);
}

const inputPath = process.argv[2] || 'C:\\Users\\KN-Avinash\\Downloads\\export (2).json';
const outputPath = process.argv[3] || 'C:\\Users\\KN-Avinash\\Downloads\\fema_logins_import.xlsx';

convertJsonToVaultixExcel(inputPath, outputPath);
