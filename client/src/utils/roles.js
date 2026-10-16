export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  USER: 'USER',
  // Backward compatibility alias:
  OWNER: 'SUPER_ADMIN',
};

export const isSuperAdmin = (userOrRole) => {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return role === ROLES.SUPER_ADMIN || role === 'OWNER';
};

// Alias for existing call sites
export const isOwner = isSuperAdmin;

export const isAdmin = (userOrRole) => {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return role === ROLES.SUPER_ADMIN || role === 'OWNER' || role === ROLES.ADMIN;
};

export const getRoleLabel = (role) => {
  switch (role) {
    case ROLES.SUPER_ADMIN:
    case 'OWNER':
      return 'Super Admin';
    case ROLES.ADMIN:
      return 'Admin';
    case ROLES.USER:
    default:
      return 'Member';
  }
};

const superAdminDef = {
  title: 'Super Admin',
  tagline: 'Supreme organization administrator',
  description:
    'Full authority over organization settings, all company vaults, billing, and administrators. Cannot be removed or demoted by Admins.',
  color: 'amber',
};

export const ROLE_DEFINITIONS = {
  SUPER_ADMIN: superAdminDef,
  OWNER: superAdminDef,
  ADMIN: {
    title: 'Administrator',
    tagline: 'Team & vault manager',
    description:
      'Can invite and manage team members, create company vaults, manage folders & departments, and review security audits. Cannot access private personal vaults.',
    color: 'indigo',
  },
  USER: {
    title: 'Member',
    tagline: 'Standard team member',
    description:
      'Access to personal private vault and company vaults or folders explicitly assigned directly or via departments.',
    color: 'slate',
  },
};
