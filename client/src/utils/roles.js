export const ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  USER: 'USER',
};

export const isOwner = (userOrRole) => {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return role === ROLES.OWNER;
};

export const isAdmin = (userOrRole) => {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return role === ROLES.OWNER || role === ROLES.ADMIN;
};

export const getRoleLabel = (role) => {
  switch (role) {
    case ROLES.OWNER:
      return 'Super Admin';
    case ROLES.ADMIN:
      return 'Admin';
    case ROLES.USER:
    default:
      return 'Member';
  }
};

export const ROLE_DEFINITIONS = {
  OWNER: {
    title: 'Super Admin',
    tagline: 'Supreme organization administrator',
    description:
      'Full authority over organization settings, all company vaults, billing, and administrators. Cannot be removed or demoted by Admins.',
    color: 'amber',
  },
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
