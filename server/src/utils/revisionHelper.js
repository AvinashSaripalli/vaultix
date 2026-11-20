const generateId = require('./generateId');

/**
 * Computes a human-readable summary of what fields changed between revisions
 */
function computeChangeSummary(existing, incoming) {
  const changes = [];
  if (
    incoming.encryptedPassword !== undefined &&
    incoming.encryptedPassword !== existing.encryptedPassword
  ) {
    changes.push('Password rotated');
  }
  if (incoming.login !== undefined && incoming.login !== existing.login) {
    changes.push('Username changed');
  }
  if (incoming.name !== undefined && incoming.name !== existing.name) {
    changes.push('Title updated');
  }
  if (incoming.url !== undefined && incoming.url !== existing.url) {
    changes.push('Website URL updated');
  }
  if (
    incoming.encryptedNote !== undefined &&
    incoming.encryptedNote !== existing.encryptedNote
  ) {
    changes.push('Notes updated');
  }
  if (
    incoming.encryptedFields !== undefined &&
    incoming.encryptedFields !== existing.encryptedFields
  ) {
    changes.push('Custom fields updated');
  }
  return changes.length > 0 ? changes.join(', ') : 'Item updated';
}

/**
 * Archives the existing state of a PasswordEntry into PasswordRevision
 * Keeps at most 20 recent revisions to prevent database bloat.
 */
async function archivePasswordRevision(tx, existingPassword, userId, summary = null) {
  const currentVer = existingPassword.currentVersion || 1;

  // Insert historical snapshot
  await tx.passwordRevision.create({
    data: {
      id: generateId('passwordRevision'),
      passwordId: existingPassword.id,
      version: currentVer,
      name: existingPassword.name,
      login: existingPassword.login,
      type: existingPassword.type,
      encryptedPassword: existingPassword.encryptedPassword,
      encryptedFields: existingPassword.encryptedFields,
      encryptedNote: existingPassword.encryptedNote,
      wrappedKeys: existingPassword.wrappedKeys,
      url: existingPassword.url,
      colorTag: existingPassword.colorTag,
      createdById: userId || existingPassword.createdById,
      createdAt:
        existingPassword.lastUpdatedAt ||
        existingPassword.updatedAt ||
        existingPassword.createdAt ||
        new Date(),
      changeSummary: summary || 'Previous version',
    },
  });

  // Prune older revisions beyond 20
  const count = await tx.passwordRevision.count({
    where: { passwordId: existingPassword.id },
  });

  if (count > 20) {
    const oldest = await tx.passwordRevision.findMany({
      where: { passwordId: existingPassword.id },
      orderBy: { version: 'asc' },
      take: count - 20,
      select: { id: true },
    });
    if (oldest.length > 0) {
      await tx.passwordRevision.deleteMany({
        where: { id: { in: oldest.map((r) => r.id) } },
      });
    }
  }

  return currentVer + 1;
}

module.exports = {
  computeChangeSummary,
  archivePasswordRevision,
};
