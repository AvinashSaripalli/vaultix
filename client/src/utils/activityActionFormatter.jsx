import React from 'react';
import {
  CreditCard,
  Landmark,
  FileText,
  Terminal,
  KeyRound,
  Database,
  Wifi,
  Sparkles,
  Copy,
  Eye,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Share2,
  Folder,
  Shield,
  UserCheck,
  CheckCircle,
  Key,
} from 'lucide-react';

/**
 * Resolves the logical item type for an activity log.
 * Prioritizes explicitly stored metadata, then targetType, then retroactive heuristics.
 */
export function resolveItemType(log) {
  if (!log) return 'LOGIN';

  const metaType = log.metadata?.itemType || log.metadata?.type;
  if (metaType && typeof metaType === 'string') {
    return metaType.toUpperCase();
  }

  // If not a password entry (e.g. Folder, Vault, Dept, User, Approval)
  if (log.targetType && log.targetType !== 'PasswordEntry') {
    return null;
  }

  // Retroactive heuristic for historical logs
  const name = (log.metadata?.name || '').toLowerCase();
  if (/\b(card|debit|credit|visa|mastercard|amex|rupay)\b/i.test(name)) {
    return 'CARD';
  }
  if (/\b(bank|netbanking|account|savings|current|ifsc|sbi|hdfc|icici|axis|chase|citi|pnb)\b/i.test(name)) {
    return 'BANK_ACCOUNT';
  }
  if (/\b(api|token|secret key|access key)\b/i.test(name)) {
    return 'API_TOKEN';
  }
  if (/\b(ssh|rsa|id_ed25519|public key|private key)\b/i.test(name)) {
    return 'SSH_KEY';
  }
  if (/\b(note|document|memo)\b/i.test(name)) {
    return 'SECURE_NOTE';
  }
  if (/\b(wifi|wi-fi|router|ssid)\b/i.test(name)) {
    return 'WIFI';
  }
  if (/\b(database|postgres|mysql|mongodb|redis|oracle)\b/i.test(name)) {
    return 'DATABASE';
  }

  return 'LOGIN';
}

/**
 * Converts a technical fieldName into a user-friendly label.
 */
export function resolveFieldLabel(fieldName, itemType = 'LOGIN') {
  if (!fieldName) return '';

  const key = String(fieldName).trim();
  switch (key) {
    case 'cvv':
    case 'cvc':
      return 'CVV';
    case 'cardNumber':
      return 'Card Number';
    case 'cardholderName':
      return 'Cardholder Name';
    case 'expiryMonth':
    case 'expiryYear':
    case 'expiry':
      return 'Card Expiry';
    case 'pin':
      return itemType === 'CARD' ? 'Card PIN' : 'PIN';
    case 'accountNumber':
      return 'Account Number';
    case 'routingNumber':
      return 'IFSC / Routing';
    case 'bankName':
      return 'Bank Name';
    case 'accountType':
      return 'Account Type';
    case 'branchAddress':
      return 'Branch Address';
    case 'transactionPassword':
      return 'Transaction PIN';
    case 'password':
      return 'Password';
    case 'login':
    case 'username':
      if (itemType === 'BANK_ACCOUNT') return 'Customer ID';
      if (itemType === 'CARD') return 'Cardholder';
      return 'Username';
    case 'url':
      return 'Website URL';
    case 'note':
      return 'Note';
    default:
      // Format camelCase or snake_case
      return key
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/**
 * Produces an accurate, human-readable action label based on the action,
 * the specific item type, and any field manipulated.
 */
export function formatItemAction(action, metadata = {}, log = null) {
  const itemType = metadata?.itemType || resolveItemType(log || { metadata, targetType: 'PasswordEntry' });
  const fieldName = metadata?.fieldName;

  // 1. Specific field action
  if (fieldName) {
    const fieldLabel = resolveFieldLabel(fieldName, itemType);
    if (action === 'COPY_PASSWORD' || action === 'COPY_FIELD') {
      return `Copy ${fieldLabel}`;
    }
    if (action === 'VIEW_PASSWORD' || action === 'VIEW_FIELD') {
      return `View ${fieldLabel}`;
    }
  }

  // 2. Item-type specific actions
  if (itemType === 'CARD') {
    switch (action) {
      case 'VIEW_PASSWORD': return 'View Card Details';
      case 'COPY_PASSWORD': return 'Copy Card Number';
      case 'AUTOFILL_PASSWORD': return 'Autofill Card';
      case 'CREATE_PASSWORD': return 'Create Card';
      case 'UPDATE_PASSWORD': return 'Update Card';
      case 'DELETE_PASSWORD': return 'Delete Card';
      case 'RESTORE_PASSWORD': return 'Restore Card';
      case 'SHARE_PASSWORD': return 'Share Card';
      case 'REVOKE_PASSWORD_SHARE': return 'Revoke Card Share';
      default: break;
    }
  }

  if (itemType === 'BANK_ACCOUNT') {
    switch (action) {
      case 'VIEW_PASSWORD': return 'View Bank Details';
      case 'COPY_PASSWORD': return 'Copy Account Details';
      case 'AUTOFILL_PASSWORD': return 'Autofill NetBanking';
      case 'CREATE_PASSWORD': return 'Create Bank Account';
      case 'UPDATE_PASSWORD': return 'Update Bank Account';
      case 'DELETE_PASSWORD': return 'Delete Bank Account';
      case 'RESTORE_PASSWORD': return 'Restore Bank Account';
      case 'SHARE_PASSWORD': return 'Share Bank Account';
      case 'REVOKE_PASSWORD_SHARE': return 'Revoke Bank Share';
      default: break;
    }
  }

  if (itemType === 'SECURE_NOTE') {
    switch (action) {
      case 'VIEW_PASSWORD': return 'View Secure Note';
      case 'COPY_PASSWORD': return 'Copy Secure Note';
      case 'CREATE_PASSWORD': return 'Create Secure Note';
      case 'UPDATE_PASSWORD': return 'Update Secure Note';
      case 'DELETE_PASSWORD': return 'Delete Secure Note';
      case 'RESTORE_PASSWORD': return 'Restore Secure Note';
      default: break;
    }
  }

  if (itemType === 'API_TOKEN') {
    switch (action) {
      case 'VIEW_PASSWORD': return 'View API Token';
      case 'COPY_PASSWORD': return 'Copy API Token';
      case 'CREATE_PASSWORD': return 'Create API Token';
      case 'UPDATE_PASSWORD': return 'Update API Token';
      case 'DELETE_PASSWORD': return 'Delete API Token';
      case 'RESTORE_PASSWORD': return 'Restore API Token';
      default: break;
    }
  }

  if (itemType === 'SSH_KEY') {
    switch (action) {
      case 'VIEW_PASSWORD': return 'View SSH Key';
      case 'COPY_PASSWORD': return 'Copy SSH Key';
      case 'CREATE_PASSWORD': return 'Create SSH Key';
      case 'UPDATE_PASSWORD': return 'Update SSH Key';
      case 'DELETE_PASSWORD': return 'Delete SSH Key';
      default: break;
    }
  }

  if (itemType === 'DATABASE') {
    switch (action) {
      case 'VIEW_PASSWORD': return 'View DB Credentials';
      case 'COPY_PASSWORD': return 'Copy DB Password';
      case 'CREATE_PASSWORD': return 'Create Database';
      case 'UPDATE_PASSWORD': return 'Update Database';
      case 'DELETE_PASSWORD': return 'Delete Database';
      default: break;
    }
  }

  if (itemType === 'WIFI') {
    switch (action) {
      case 'VIEW_PASSWORD': return 'View Wi-Fi Password';
      case 'COPY_PASSWORD': return 'Copy Wi-Fi Password';
      case 'CREATE_PASSWORD': return 'Add Wi-Fi';
      case 'UPDATE_PASSWORD': return 'Update Wi-Fi';
      case 'DELETE_PASSWORD': return 'Delete Wi-Fi';
      default: break;
    }
  }

  // 3. Fallback standard platform actions
  switch (action) {
    case 'CREATE_FOLDER': return 'Create Folder';
    case 'UPDATE_FOLDER': return 'Update Folder';
    case 'DELETE_FOLDER': return 'Delete Folder';
    case 'RESTORE_FOLDER': return 'Restore Folder';
    case 'SHARE_FOLDER': return 'Share Folder';
    case 'UPDATE_FOLDER_PERMISSION': return 'Update Folder Permission';
    case 'REVOKE_FOLDER_ACCESS': return 'Revoke Folder Access';
    case 'CREATE_PASSWORD': return 'Create Login';
    case 'UPDATE_PASSWORD': return 'Update Login';
    case 'DELETE_PASSWORD': return 'Delete Login';
    case 'RESTORE_PASSWORD': return 'Restore Login';
    case 'VIEW_PASSWORD': return 'View Password';
    case 'COPY_PASSWORD': return 'Copy Password';
    case 'AUTOFILL_PASSWORD': return 'Autofill Login';
    case 'SHARE_PASSWORD': return 'Share Credential';
    case 'REVOKE_PASSWORD_SHARE': return 'Revoke Credential Share';
    case 'CREATE_VAULT': return 'Create Vault';
    case 'UPDATE_VAULT': return 'Update Vault';
    case 'DELETE_VAULT': return 'Delete Vault';
    case 'UNSHARE_VAULT': return 'Unshare Vault';
    case 'IMPORT_PASSWORDS': return 'Import Passwords';
    case 'SHARE_VAULT': return 'Share Vault';
    case 'CREATE_USER': return 'Create User';
    case 'UPDATE_USER': return 'Update User';
    case 'DELETE_USER': return 'Delete User';
    case 'CREATE_DEPARTMENT': return 'Create Department';
    case 'UPDATE_DEPARTMENT': return 'Update Department';
    case 'DELETE_DEPARTMENT': return 'Delete Department';
    case 'ADD_DEPARTMENT_MEMBER': return 'Add Dept Member';
    case 'REMOVE_DEPARTMENT_MEMBER': return 'Remove Dept Member';
    case 'UPDATE_DEPARTMENT_MEMBER': return 'Update Dept Member';
    case 'GRANT_DEPARTMENT_ACCESS': return 'Grant Dept Access';
    case 'REVOKE_DEPARTMENT_ACCESS': return 'Revoke Dept Access';
    case 'ENABLE_2FA': return 'Enable 2FA';
    case 'DISABLE_2FA': return 'Disable 2FA';
    case 'VERIFY_EMAIL': return 'Verify Email';
    case 'REVOKE_SESSION': return 'Revoke Session';
    case 'UPDATE_ORGANIZATION_POLICY': return 'Update Org Policy';
    case 'CREATE_APPROVAL_REQUEST': return 'Create Approval Request';
    case 'APPROVE_REQUEST': return 'Approve Request';
    case 'REJECT_REQUEST': return 'Reject Request';
    case 'CANCEL_APPROVAL_REQUEST': return 'Cancel Approval Request';
    default: return action?.replaceAll('_', ' ') || '-';
  }
}

/**
 * Returns Tailwind badge styling for an activity log action.
 */
export function getActionBadge(action, itemType = 'LOGIN') {
  if (action === 'AUTOFILL_PASSWORD') {
    return 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
  }
  if (action?.startsWith('CREATE') || action?.startsWith('RESTORE') || action === 'ENABLE_2FA' || action === 'APPROVE_REQUEST') {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400';
  }
  if (action?.startsWith('UPDATE') || action === 'UPDATE_ORGANIZATION_POLICY') {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400';
  }
  if (
    action?.startsWith('DELETE') ||
    action?.startsWith('REVOKE') ||
    action?.startsWith('UNSHARE') ||
    action?.startsWith('REMOVE') ||
    action === 'DISABLE_2FA' ||
    action === 'REJECT_REQUEST'
  ) {
    return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400';
  }
  if (action?.startsWith('VIEW')) {
    if (itemType === 'CARD') {
      return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    }
    if (itemType === 'BANK_ACCOUNT') {
      return 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300';
    }
    return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400';
  }
  if (action?.startsWith('COPY')) {
    if (itemType === 'CARD' || itemType === 'BANK_ACCOUNT') {
      return 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
    }
    return 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400';
  }
  if (action?.startsWith('SHARE') || action?.startsWith('GRANT')) {
    return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400';
  }
  if (action?.startsWith('IMPORT')) {
    return 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400';
  }
  return 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

/**
 * Returns an appropriate icon element for an action and item type.
 */
export function getActionIcon(action, itemType = 'LOGIN', fieldName = null) {
  const size = 14;

  if (action === 'AUTOFILL_PASSWORD') {
    return <Sparkles size={size} className="shrink-0" />;
  }

  if (action?.startsWith('COPY') || action === 'COPY_FIELD') {
    return <Copy size={size} className="shrink-0" />;
  }

  if (action?.startsWith('VIEW') || action === 'VIEW_FIELD') {
    if (itemType === 'CARD') return <CreditCard size={size} className="shrink-0" />;
    if (itemType === 'BANK_ACCOUNT') return <Landmark size={size} className="shrink-0" />;
    if (itemType === 'SECURE_NOTE') return <FileText size={size} className="shrink-0" />;
    if (itemType === 'SSH_KEY') return <Terminal size={size} className="shrink-0" />;
    if (itemType === 'API_TOKEN') return <KeyRound size={size} className="shrink-0" />;
    return <Eye size={size} className="shrink-0" />;
  }

  if (action?.startsWith('CREATE')) {
    return <Plus size={size} className="shrink-0" />;
  }

  if (action?.startsWith('UPDATE')) {
    return <Pencil size={size} className="shrink-0" />;
  }

  if (action?.startsWith('DELETE')) {
    return <Trash2 size={size} className="shrink-0" />;
  }

  if (action?.startsWith('RESTORE')) {
    return <RotateCcw size={size} className="shrink-0" />;
  }

  if (action?.startsWith('SHARE') || action?.startsWith('GRANT')) {
    return <Share2 size={size} className="shrink-0" />;
  }

  return <Eye size={size} className="shrink-0" />;
}

/**
 * Returns visual chip metadata for the Item Type (CARD, BANK, NOTE, etc.)
 */
export function getItemTypeBadge(itemType) {
  if (!itemType || itemType === 'LOGIN') return null;

  switch (itemType) {
    case 'CARD':
      return {
        label: 'CARD',
        className: 'bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/40',
      };
    case 'BANK_ACCOUNT':
      return {
        label: 'BANK',
        className: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40',
      };
    case 'SECURE_NOTE':
      return {
        label: 'NOTE',
        className: 'bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40',
      };
    case 'API_TOKEN':
      return {
        label: 'API',
        className: 'bg-purple-50 text-purple-700 border border-purple-200/60 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/40',
      };
    case 'SSH_KEY':
      return {
        label: 'SSH',
        className: 'bg-cyan-50 text-cyan-700 border border-cyan-200/60 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800/40',
      };
    case 'DATABASE':
      return {
        label: 'DB',
        className: 'bg-indigo-50 text-indigo-700 border border-indigo-200/60 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800/40',
      };
    case 'WIFI':
      return {
        label: 'WIFI',
        className: 'bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800/40',
      };
    default:
      return {
        label: itemType,
        className: 'bg-slate-100 text-slate-700 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      };
  }
}
