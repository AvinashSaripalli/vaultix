const crypto = require('crypto');

const config = {
  user: 'USER',
  vault: 'VAULT',
  folder: 'FOL',
  folderPermission: 'FPERM',
  vaultPermission: 'VPERM',
  passwordEntry: 'PWD',
  activityLog: 'ACT',
  activity: 'ACT',
  invitation: 'INV',
  passwordShare: 'PSHARE',
  loginActivity: 'LOGIN',
  notification: 'NOTIF',
  tag: 'TAG',
  department: 'DEPT',
  departmentMember: 'DPERM',
  departmentPermission: 'DACCESS',
  keyPair: 'KPAIR',
  webauthn: 'WEBAUTH',
  req: 'REQ',
  approvalRequest: 'REQ',
  adminApprovalRequest: 'REQ',
};

function generateId(model) {
  const prefix = config[model];

  if (!prefix) {
    throw new Error(`Unsupported model: ${model}`);
  }

  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();

  return `${prefix}-${uuid}`;
}

module.exports = generateId;
