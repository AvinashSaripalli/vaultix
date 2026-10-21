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
