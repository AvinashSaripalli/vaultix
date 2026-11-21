export const DEPARTMENT_TAG_GROUPS = [
  {
    id: 'finance',
    name: 'Finance & Tax',
    description: 'Banking, tax filings, payroll, and corporate cards',
    itemTypes: ['CARD', 'BANK_ACCOUNT'],
    tags: [
      'Finance',
      'GST / Tax',
      'Banking-Corporate',
      'Payroll',
      'Vendor-Payments',
      'Corporate-Card',
      'Auditor-Access',
      'Reimbursements',
      'Invoicing',
    ],
  },
  {
    id: 'compliance',
    name: 'Compliance & Legal',
    description: 'ROC, MCA, FEMA, KYC documents, and regulatory filings',
    itemTypes: ['IDENTITY'],
    tags: [
      'Compliance',
      'MCA-V3 / ROC',
      'FEMA / RBI',
      'DSC / Token',
      'Director-KYC',
      'Secretarial',
      'Trademark / IP',
      'Legal-Agreements',
      'Audit-KYC',
    ],
  },
  {
    id: 'devops',
    name: 'DevOps & IT',
    description: 'Cloud infrastructure, servers, databases, and pipelines',
    itemTypes: ['SSH_KEY', 'DATABASE', 'API_TOKEN'],
    tags: [
      'DevOps',
      'Production',
      'Staging / QA',
      'Cloud / AWS / GCP',
      'Bastion / JumpHost',
      'Office-Network',
      'CI/CD-Pipeline',
      'Domain & DNS',
      'Database',
      'API-Keys',
      'Backup-Root',
    ],
  },
  {
    id: 'hr_admin',
    name: 'HR & Admin',
    description: 'Employee portals, recruitment, insurance, and office networks',
    itemTypes: ['WIFI'],
    tags: [
      'HR',
      'HRMS',
      'Recruitment / ATS',
      'Health-Insurance',
      'Background-Check',
      'Office-Admin',
      'Asset-Management',
      'Office-Network',
    ],
  },
  {
    id: 'marketing_sales',
    name: 'Sales & Marketing',
    description: 'CRM, ad accounts, social media, and client communications',
    itemTypes: ['LICENSE'],
    tags: [
      'Marketing',
      'CRM',
      'Ad-Accounts',
      'Social-Media',
      'Email-Campaigns',
      'SEO / Analytics',
      'Client-Portal',
      'Software-License',
    ],
  },
  {
    id: 'executive',
    name: 'Executive & Board',
    description: 'Founders, directors, cap table, and break-glass emergency keys',
    itemTypes: ['RECOVERY_CODE', 'SECURE_NOTE'],
    tags: [
      'Executive',
      'CapTable',
      'Banking-Signatory',
      'Confidential / NDA',
      'Master-Recovery',
      'Break-Glass',
      'Board-Secretarial',
    ],
  },
  {
    id: 'support_ops',
    name: 'Support & Ops',
    description: 'Helpdesk, payment gateways, and client support channels',
    itemTypes: ['LOGIN'],
    tags: [
      'Support',
      'Helpdesk',
      'Payment-Gateway',
      'Communication / VoIP',
      'Shared-Login',
      'Vendor-Portal',
    ],
  },
  {
    id: 'status',
    name: 'Status & Security',
    description: 'Access tier, 2FA requirements, and item lifecycle',
    itemTypes: [],
    tags: [
      'Active',
      'Shared',
      'Restricted',
      '2FA-Required',
      'Expiring-Soon',
      'Temporary',
      'Critical',
    ],
  },
];

export const ALL_DEPARTMENT_TAGS = Array.from(
  new Set(DEPARTMENT_TAG_GROUPS.flatMap((group) => group.tags))
);

export const getDefaultDepartmentForType = (itemType) => {
  if (!itemType) return 'finance';
  const match = DEPARTMENT_TAG_GROUPS.find((group) =>
    group.itemTypes.includes(itemType)
  );
  return match ? match.id : 'devops';
};

export const getQuickSuggestedTagsForType = (itemType) => {
  switch (itemType) {
    case 'CARD':
      return ['Corporate-Card', 'Finance', 'Vendor-Payments', 'Travel', 'Subscriptions'];
    case 'BANK_ACCOUNT':
      return ['Banking-Corporate', 'Finance', 'Payroll', 'GST / Tax', 'Vendor-Payments'];
    case 'IDENTITY':
      return ['Director-KYC', 'Compliance', 'MCA-V3 / ROC', 'FEMA / RBI', 'Employee'];
    case 'SSH_KEY':
      return ['Production', 'DevOps', 'Bastion / JumpHost', 'Staging / QA', 'CI/CD-Pipeline'];
    case 'DATABASE':
      return ['Production', 'Database', 'DevOps', 'Staging / QA', 'Analytics'];
    case 'API_TOKEN':
      return ['Production', 'Cloud / AWS / GCP', 'API-Keys', 'CI/CD-Pipeline', 'DevOps'];
    case 'WIFI':
      return ['Office-Network', 'Office-Admin', 'Guest-WiFi', 'Warehouse', 'DevOps'];
    case 'LICENSE':
      return ['Software-License', 'Marketing', 'Office-Admin', 'Expiring-Soon'];
    case 'RECOVERY_CODE':
      return ['Break-Glass', 'Master-Recovery', 'Executive', 'Backup-Root', 'Critical'];
    case 'SECURE_NOTE':
      return ['Confidential / NDA', 'Runbook / SOP', 'Infrastructure', 'Audit-KYC'];
    default:
      return ['Production', 'Finance', 'Client-Portal', 'Shared', 'Admin'];
  }
};

// Domain-to-Tag Mapping Rules for Real-World Services & Portals
export const DOMAIN_TAG_RULES = [
  // Indian Government, Tax & Compliance
  { pattern: /gst\.gov\.in/i, tags: ['GST / Tax', 'Compliance', 'Finance'] },
  { pattern: /incometax\.gov\.in/i, tags: ['Income Tax', 'GST / Tax', 'Compliance', 'Finance'] },
  { pattern: /tin-nsdl\.com|tdscpc\.gov\.in/i, tags: ['TDS', 'Income Tax', 'GST / Tax', 'Finance'] },
  { pattern: /mca\.gov\.in/i, tags: ['MCA-V3 / ROC', 'Compliance', 'Secretarial'] },
  { pattern: /rbi\.org\.in/i, tags: ['FEMA / RBI', 'Compliance'] },
  { pattern: /dgft\.gov\.in|icegate\.gov\.in/i, tags: ['Customs', 'FEMA / RBI', 'Compliance', 'Import Export'] },
  { pattern: /epfindia\.gov\.in/i, tags: ['EPFO', 'Payroll', 'HR', 'Compliance'] },
  { pattern: /esic\.gov\.in/i, tags: ['ESIC', 'Payroll', 'HR', 'Compliance'] },

  // Banking (Corporate & Retail)
  { pattern: /hdfcbank\.com/i, tags: ['Banking-Corporate', 'Finance'] },
  { pattern: /icicibank\.com/i, tags: ['Banking-Corporate', 'Finance'] },
  { pattern: /sbi\.co\.in|onlinesbi\.sbi/i, tags: ['Banking-Corporate', 'Finance'] },
  { pattern: /axisbank\.com/i, tags: ['Banking-Corporate', 'Finance'] },
  { pattern: /kotak\.com/i, tags: ['Banking-Corporate', 'Finance'] },
  { pattern: /indusind\.com/i, tags: ['Banking-Corporate', 'Finance'] },

  // Payment Gateways & Accounting
  { pattern: /razorpay\.com/i, tags: ['Payment-Gateway', 'Finance', 'Production'] },
  { pattern: /stripe\.com/i, tags: ['Payment-Gateway', 'Finance', 'Production'] },
  { pattern: /cashfree\.com/i, tags: ['Payment-Gateway', 'Finance'] },
  { pattern: /payu\.in/i, tags: ['Payment-Gateway', 'Finance'] },
  { pattern: /zoho\.com\/books|books\.zoho/i, tags: ['Finance', 'Invoicing'] },
  { pattern: /quickbooks/i, tags: ['Finance', 'Invoicing'] },

  // Cloud & Infrastructure & Hosting
  { pattern: /aws\.amazon\.com|amazonaws\.com/i, tags: ['Cloud / AWS / GCP', 'DevOps', 'Production'] },
  { pattern: /cloud\.google\.com/i, tags: ['Cloud / AWS / GCP', 'DevOps', 'Production'] },
  { pattern: /portal\.azure\.com|azure\.com/i, tags: ['Cloud / AWS / GCP', 'DevOps', 'Production'] },
  { pattern: /github\.com/i, tags: ['CI/CD-Pipeline', 'DevOps'] },
  { pattern: /gitlab\.com/i, tags: ['CI/CD-Pipeline', 'DevOps'] },
  { pattern: /bitbucket\.org/i, tags: ['CI/CD-Pipeline', 'DevOps'] },
  { pattern: /cloudflare\.com/i, tags: ['Domain & DNS', 'DevOps'] },
  { pattern: /godaddy\.com/i, tags: ['Domain & DNS', 'DevOps'] },
  { pattern: /namecheap\.com/i, tags: ['Domain & DNS', 'DevOps'] },
  { pattern: /hostinger\.com/i, tags: ['DevOps', 'Production'] },
  { pattern: /digitalocean\.com/i, tags: ['DevOps', 'Cloud / AWS / GCP'] },
  { pattern: /vercel\.com|netlify\.com/i, tags: ['DevOps', 'Production'] },
  { pattern: /heroku\.com/i, tags: ['DevOps', 'Cloud / AWS / GCP'] },
  { pattern: /atlassian\.net|jira\.com/i, tags: ['DevOps', 'Internal'] },

  // HRMS & Payroll
  { pattern: /keka\.com/i, tags: ['HRMS', 'Payroll', 'HR'] },
  { pattern: /darwinbox\.com/i, tags: ['HRMS', 'Payroll', 'HR'] },
  { pattern: /zoho\.com\/people|people\.zoho/i, tags: ['HRMS', 'HR'] },
  { pattern: /greytip\.com|greythr\.com/i, tags: ['HRMS', 'Payroll', 'HR'] },
  { pattern: /linkedin\.com\/talent|linkedin\.com\/recruiter/i, tags: ['Recruitment / ATS', 'HR'] },
  { pattern: /naukri\.com/i, tags: ['Recruitment / ATS', 'HR'] },

  // CRM & Marketing
  { pattern: /hubspot\.com/i, tags: ['CRM', 'Marketing'] },
  { pattern: /salesforce\.com|force\.com/i, tags: ['CRM', 'Marketing'] },
  { pattern: /zoho\.com\/crm|crm\.zoho/i, tags: ['CRM', 'Marketing'] },
  { pattern: /ads\.google\.com/i, tags: ['Ad-Accounts', 'Marketing'] },
  { pattern: /facebook\.com\/ads|meta\.com/i, tags: ['Ad-Accounts', 'Marketing'] },
  { pattern: /mailchimp\.com|sendgrid\.com|brevo\.com/i, tags: ['Email-Campaigns', 'Marketing'] },
  { pattern: /semrush\.com|ahrefs\.com/i, tags: ['SEO / Analytics', 'Marketing'] },

  // Support & Comms
  { pattern: /zendesk\.com/i, tags: ['Helpdesk', 'Support'] },
  { pattern: /freshdesk\.com/i, tags: ['Helpdesk', 'Support'] },
  { pattern: /intercom\.com/i, tags: ['Helpdesk', 'Support'] },
  { pattern: /slack\.com/i, tags: ['Communication / VoIP', 'Shared'] },
  { pattern: /zoom\.us/i, tags: ['Communication / VoIP'] },
];

/**
 * 36 Indian States and Union Territories with 2-letter codes & 2-digit GST prefix numbers.
 */
export const INDIAN_STATES_MAP = {
  ap: { code: 'AP', name: 'Andhra Pradesh', gstPrefix: '37' },
  ts: { code: 'TS', name: 'Telangana', gstPrefix: '36' },
  tg: { code: 'TS', name: 'Telangana', gstPrefix: '36' },
  ka: { code: 'KA', name: 'Karnataka', gstPrefix: '29' },
  mh: { code: 'MH', name: 'Maharashtra', gstPrefix: '27' },
  tn: { code: 'TN', name: 'Tamil Nadu', gstPrefix: '33' },
  dl: { code: 'DL', name: 'Delhi', gstPrefix: '07' },
  gj: { code: 'GJ', name: 'Gujarat', gstPrefix: '24' },
  kl: { code: 'KL', name: 'Kerala', gstPrefix: '32' },
  wb: { code: 'WB', name: 'West Bengal', gstPrefix: '19' },
  up: { code: 'UP', name: 'Uttar Pradesh', gstPrefix: '09' },
  hr: { code: 'HR', name: 'Haryana', gstPrefix: '06' },
  rj: { code: 'RJ', name: 'Rajasthan', gstPrefix: '08' },
  mp: { code: 'MP', name: 'Madhya Pradesh', gstPrefix: '23' },
  pb: { code: 'PB', name: 'Punjab', gstPrefix: '03' },
  or: { code: 'OD', name: 'Odisha', gstPrefix: '21' },
  od: { code: 'OD', name: 'Odisha', gstPrefix: '21' },
  ch: { code: 'CH', name: 'Chandigarh', gstPrefix: '04' },
  ga: { code: 'GA', name: 'Goa', gstPrefix: '30' },
  br: { code: 'BR', name: 'Bihar', gstPrefix: '10' },
  jh: { code: 'JH', name: 'Jharkhand', gstPrefix: '20' },
  as: { code: 'AS', name: 'Assam', gstPrefix: '18' },
  uk: { code: 'UK', name: 'Uttarakhand', gstPrefix: '05' },
  ut: { code: 'UK', name: 'Uttarakhand', gstPrefix: '05' },
  hp: { code: 'HP', name: 'Himachal Pradesh', gstPrefix: '02' },
  jk: { code: 'JK', name: 'Jammu & Kashmir', gstPrefix: '01' },
  py: { code: 'PY', name: 'Puducherry', gstPrefix: '34' },
  ct: { code: 'CG', name: 'Chhattisgarh', gstPrefix: '22' },
  cg: { code: 'CG', name: 'Chhattisgarh', gstPrefix: '22' },
};

/**
 * Detects Indian State from Title, URL, or Login (GSTIN prefix / suffix).
 */
export const detectStateFromInput = (title = '', url = '', login = '') => {
  const cleanTitle = (title || '').trim();
  const cleanLogin = (login || '').trim();
  const cleanUrl = (url || '').trim().toLowerCase();

  // 1. Check GSTIN pattern in Login (first 2 digits map to state GST prefix)
  if (/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/i.test(cleanLogin)) {
    const gstPrefix = cleanLogin.slice(0, 2);
    for (const info of Object.values(INDIAN_STATES_MAP)) {
      if (info.gstPrefix === gstPrefix) {
        return info;
      }
    }
  }

  // 2. Check Title with boundary separators (e.g. Einvoice_AP, Einvoice-AP, Einvoice AP, [AP], (AP), AP_Einvoice)
  for (const [key, info] of Object.entries(INDIAN_STATES_MAP)) {
    // Avoid short common words like 'as', 'or', 'in', 'to' unless explicitly delimited
    const isCommonWord = ['as', 'or', 'in', 'to', 'at', 'is', 'on'].includes(key);

    const patterns = [
      new RegExp(`[\\b_\\-\\(\\)\\[\\]\\/\\\\]${key}[\\b_\\-\\(\\)\\[\\]\\/\\\\]`, 'i'),
      new RegExp(`[\\b_\\-\\(\\)\\[\\]\\/\\\\]${key}$`, 'i'),
      new RegExp(`^${key}[\\b_\\-\\(\\)\\[\\]\\/\\\\]`, 'i'),
      new RegExp(`\\b${info.name.replace(/\s+/g, '\\s*')}\\b`, 'i'),
    ];

    if (!isCommonWord) {
      patterns.push(new RegExp(`\\b${key}\\b`, 'i'));
    }

    if (patterns.some((re) => re.test(cleanTitle))) {
      return info;
    }
  }

  // 3. Check Substring inside Login when in tax/portal context (e.g., ibckap2013 -> contains "ap")
  const isComplianceContext = /gst|invoice|eway|tax|vat|mca|pt/i.test(cleanTitle + cleanUrl);
  if (isComplianceContext && cleanLogin.length >= 4) {
    for (const [key, info] of Object.entries(INDIAN_STATES_MAP)) {
      if (!['as', 'or', 'in', 'to', 'at', 'is', 'on'].includes(key)) {
        if (cleanLogin.toLowerCase().includes(key)) {
          return info;
        }
      }
    }
  }

  // 4. Check URL domain / subdomain for state names (e.g., tg.gov.in, ap.gov.in, karnataka.gov.in)
  for (const [key, info] of Object.entries(INDIAN_STATES_MAP)) {
    if (cleanUrl.includes(`${key}.gov.in`) || cleanUrl.includes(`${info.name.toLowerCase().replace(/\s+/g, '')}.gov.in`)) {
      return info;
    }
  }

  return null;
};

/**
 * Extracts a clean domain and hostname from any URL string.
 */
export const extractHostname = (url) => {
  if (!url || typeof url !== 'string') return '';
  const clean = url.trim();
  if (!clean) return '';
  try {
    const withProto = clean.match(/^https?:\/\//i) ? clean : `https://${clean}`;
    const parsed = new URL(withProto);
    return parsed.hostname.toLowerCase();
  } catch {
    return clean
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .split('?')[0]
      .split(':')[0]
      .toLowerCase();
  }
};

/**
 * Resolves smart suggested tags for a given URL based on:
 * 1. Vault historical memory (if another item with this domain has tags)
 * 2. Service/domain rules (GST, MCA, HDFC, AWS, etc.)
 * 3. Environment subdomain heuristics (staging.*, dev.*, prod.*)
 */
export const getTagsForUrl = (url, existingVaultItems = []) => {
  const host = extractHostname(url);
  if (!host || host.length < 3) return { domain: '', tags: [] };

  const detectedTags = new Set();

  // Tier 1: Check Vault Memory (prioritize what the organization already uses for this domain)
  if (Array.isArray(existingVaultItems) && existingVaultItems.length > 0) {
    existingVaultItems.forEach((item) => {
      const itemUrl = item.url || item.fields?.url || item.fields?.baseUrl;
      if (!itemUrl) return;
      const itemHost = extractHostname(itemUrl);
      if (itemHost && (itemHost === host || host.endsWith(`.${itemHost}`) || itemHost.endsWith(`.${host}`))) {
        (item.tags || []).forEach((t) => {
          const name = typeof t === 'string' ? t : t?.tag?.name;
          if (name && name.trim()) detectedTags.add(name.trim());
        });
      }
    });
  }

  // Tier 2: Check Domain Rules
  for (const rule of DOMAIN_TAG_RULES) {
    if (rule.pattern.test(host)) {
      rule.tags.forEach((tag) => detectedTags.add(tag));
    }
  }

  // Tier 3: Subdomain Environment Detection
  if (/^(staging|qa|test|stage)\./i.test(host)) {
    detectedTags.add('Staging / QA');
  } else if (/^(dev|sandbox|local)\./i.test(host)) {
    detectedTags.add('Development');
  } else if (/^(prod|production)\./i.test(host)) {
    detectedTags.add('Production');
  } else if (/^(admin|portal|client)\./i.test(host)) {
    detectedTags.add('Client-Portal');
  }

  return {
    domain: host,
    tags: Array.from(detectedTags),
  };
};

/**
 * Resolves context-aware, composite smart tag suggestions based on:
 * 1. Title / Name (e.g. Einvoice_AP, GST Portal TS, MCA Director Login)
 * 2. Website URL / Host (e.g. einvoice1.gst.gov.in, mca.gov.in)
 * 3. Login / Username (e.g. ibckap2013, GSTIN 37AAACB...)
 * 4. Folder Name context (e.g. Aaroghya Distribution Private Limited)
 * 5. State detection (AP, TS, KA, MH, TN, DL, etc. synthesized into 'GST AP', 'E-Invoice AP')
 * 6. Historical Vault memory
 */
export const getSmartSuggestedTags = ({
  title = '',
  url = '',
  login = '',
  folderName = '',
  itemType = '',
  existingVaultItems = [],
} = {}) => {
  const host = extractHostname(url);
  const cleanTitle = (title || '').trim();
  const titleLower = cleanTitle.toLowerCase();
  const cleanLogin = (login || '').trim();
  const stateInfo = detectStateFromInput(cleanTitle, url, cleanLogin);

  const smartTags = new Set();
  const categoryTags = new Set();
  const vaultMemoryTags = new Set();

  // --- GST / E-Invoice / E-Waybill Engine ---
  const isGstDomain = /(?:^|\.)(?:gst|einvoice\d*|ewaybillgst)\.gov\.in/i.test(host);
  const isGstTitle = /\b(gst|gstr|einvoice|e-invoice|eway|e-waybill)\b/i.test(titleLower);

  if (isGstDomain || isGstTitle) {
    if (stateInfo) {
      smartTags.add(`GST ${stateInfo.code}`);
    }
    const isEinvoice = /einvoice/i.test(titleLower) || /einvoice/i.test(host);
    const isEway = /eway/i.test(titleLower) || /ewaybill/i.test(host);

    if (isEinvoice) {
      smartTags.add('E-Invoice');
      if (stateInfo) smartTags.add(`E-Invoice ${stateInfo.code}`);
    }
    if (isEway) {
      smartTags.add('E-Waybill');
      if (stateInfo) smartTags.add(`E-Waybill ${stateInfo.code}`);
    }
    if (!isEinvoice && !isEway && !stateInfo) {
      smartTags.add('GST');
    }

    categoryTags.add('GST / Tax');
    categoryTags.add('Compliance');
    categoryTags.add('Finance');
  }

  // --- Income Tax & TDS Engine ---
  const isItDomain = /(?:incometax|tin-nsdl|tdscpc)\.(?:gov\.in|com)/i.test(host);
  const isItTitle = /\b(itr|income\s*tax|tds|traces|form\s*16|form\s*26as)\b/i.test(titleLower);

  if (isItDomain || isItTitle) {
    if (/\b(tds|traces)\b/i.test(titleLower) || /tdscpc/i.test(host)) {
      smartTags.add('TDS');
    }
    smartTags.add('Income Tax');
    categoryTags.add('GST / Tax');
    categoryTags.add('Tax Filing');
    categoryTags.add('Compliance');
    categoryTags.add('Finance');
  }

  // --- MCA & ROC Engine ---
  const isMcaDomain = /mca\.gov\.in/i.test(host);
  const isMcaTitle = /\b(mca|roc|v3\s*portal|din|director\s*kyc|form\s*mgt|dir-3)\b/i.test(titleLower);

  if (isMcaDomain || isMcaTitle) {
    if (stateInfo) {
      smartTags.add(`ROC ${stateInfo.code}`);
    }
    if (/\b(director|din|kyc)\b/i.test(titleLower)) {
      smartTags.add('Director-KYC');
    }
    smartTags.add('MCA-V3 / ROC');
    categoryTags.add('Compliance');
    categoryTags.add('Secretarial');
  }

  // --- Professional Tax (PT) Engine ---
  const isPtTitle = /\b(pt|ptrc|ptec|professional\s*tax)\b/i.test(titleLower);
  if (isPtTitle) {
    if (stateInfo) {
      smartTags.add(`PT ${stateInfo.code}`);
    }
    smartTags.add('Professional Tax');
    categoryTags.add('Payroll');
    categoryTags.add('Compliance');
  }

  // --- EPFO & ESIC Engine ---
  const isEpfoDomain = /(?:epfindia|esic)\.gov\.in/i.test(host);
  const isEpfoTitle = /\b(epfo|pf\b|uan|esic|shram\s*suvidha|provident\s*fund)\b/i.test(titleLower);

  if (isEpfoDomain || isEpfoTitle) {
    if (/esic/i.test(titleLower) || /esic/i.test(host)) {
      smartTags.add('ESIC');
    } else {
      smartTags.add('EPFO');
      if (stateInfo) smartTags.add(`PF ${stateInfo.code}`);
    }
    categoryTags.add('Payroll');
    categoryTags.add('HR');
    categoryTags.add('Compliance');
  }

  // --- Customs, DGFT, FEMA Engine ---
  const isCustomsDomain = /(?:icegate|dgft)\.gov\.in|rbi\.org\.in/i.test(host);
  const isCustomsTitle = /\b(icegate|dgft|customs|iec|fema|rbi|foreign\s*trade)\b/i.test(titleLower);

  if (isCustomsDomain || isCustomsTitle) {
    if (/icegate|customs/i.test(titleLower) || /icegate/i.test(host)) smartTags.add('Customs');
    if (/dgft|iec/i.test(titleLower) || /dgft/i.test(host)) smartTags.add('DGFT');
    if (/fema|rbi/i.test(titleLower) || /rbi/i.test(host)) smartTags.add('FEMA / RBI');
    categoryTags.add('Compliance');
    categoryTags.add('Import Export');
  }

  // --- Banking Engine ---
  const isBankDomain = /hdfcbank|icicibank|onlinesbi|axisbank|kotak|indusind|yesbank|bankofbaroda|pnbindia/i.test(host);
  const isBankTitle = /\b(bank|netbanking|corporate\s*banking|current\s*account)\b/i.test(titleLower);

  if (isBankDomain || isBankTitle) {
    smartTags.add('Banking-Corporate');
    categoryTags.add('Finance');
    categoryTags.add('Vendor-Payments');
  }

  // --- Cloud & DevOps Engine ---
  const isCloudDomain = /aws\.amazon|amazonaws|azure|cloud\.google|digitalocean|hostinger|cloudflare|github|gitlab|vercel/i.test(host);
  const isCloudTitle = /\b(aws|azure|gcp|devops|production|staging|database|kubernetes|docker|cloud)\b/i.test(titleLower);

  if (isCloudDomain || isCloudTitle) {
    smartTags.add('Cloud / AWS / GCP');
    if (/prod/i.test(titleLower) || /prod/i.test(host)) smartTags.add('Production');
    if (/staging|qa|test/i.test(titleLower) || /staging|qa|test/i.test(host)) smartTags.add('Staging / QA');
    categoryTags.add('DevOps');
  }

  // --- Vault Memory: match existing items by domain, folder, or title keywords ---
  if (Array.isArray(existingVaultItems) && existingVaultItems.length > 0) {
    const cleanFolderName = (folderName || '').trim().toLowerCase();

    existingVaultItems.forEach((item) => {
      const itemUrl = item.url || item.fields?.url || item.fields?.baseUrl;
      const itemTitle = (item.name || item.title || '').toLowerCase();
      const itemHost = itemUrl ? extractHostname(itemUrl) : '';

      // Match domain
      const isDomainMatch = host && itemHost && (itemHost === host || host.endsWith(`.${itemHost}`) || itemHost.endsWith(`.${host}`));
      // Match state if detected
      const isStateMatch = stateInfo && itemTitle.includes(stateInfo.code.toLowerCase());

      if (isDomainMatch || isStateMatch) {
        (item.tags || []).forEach((t) => {
          const name = typeof t === 'string' ? t : t?.tag?.name;
          if (name && name.trim()) {
            vaultMemoryTags.add(name.trim());
          }
        });
      }
    });
  }

  // Fallback to URL-based tags and item type defaults if no specific smart tags were generated
  if (smartTags.size === 0) {
    const urlTags = getTagsForUrl(url, existingVaultItems);
    urlTags.tags.forEach((t) => smartTags.add(t));

    if (stateInfo) {
      smartTags.add(stateInfo.code);
    }
  }

  // Build combined priority list
  const combinedPriority = [
    ...Array.from(smartTags),
    ...Array.from(categoryTags),
    ...Array.from(vaultMemoryTags),
  ];

  return {
    domain: host,
    state: stateInfo ? stateInfo.code : null,
    stateName: stateInfo ? stateInfo.name : null,
    smartTags: Array.from(smartTags),
    categoryTags: Array.from(categoryTags),
    vaultMemoryTags: Array.from(vaultMemoryTags),
    allSuggestions: Array.from(new Set(combinedPriority)),
  };
};
