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
  { pattern: /incometax\.gov\.in/i, tags: ['GST / Tax', 'Compliance', 'Finance'] },
  { pattern: /tin-nsdl\.com/i, tags: ['GST / Tax', 'Compliance', 'Finance'] },
  { pattern: /mca\.gov\.in/i, tags: ['MCA-V3 / ROC', 'Compliance', 'Secretarial'] },
  { pattern: /rbi\.org\.in/i, tags: ['FEMA / RBI', 'Compliance'] },
  { pattern: /dgft\.gov\.in/i, tags: ['FEMA / RBI', 'Compliance'] },
  { pattern: /epfindia\.gov\.in/i, tags: ['Payroll', 'HR', 'Compliance'] },
  { pattern: /esic\.gov\.in/i, tags: ['Payroll', 'HR', 'Compliance'] },

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
