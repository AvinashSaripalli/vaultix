const crypto = require('crypto');
const prisma = require('../config/prisma');
const generateId = require('../utils/generateId');
const sendMail = require('../utils/sendMail');
const { clientUrl } = require('../utils/clientUrl');
const { renderEmail } = require('../utils/emailTemplate');

const isSuperAdminRole = (role) => role === 'SUPER_ADMIN';
const isAdminRole = (role) => ['SUPER_ADMIN', 'ADMIN'].includes(role);

const sendInvitation = async (req, res) => {
  try {
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { email, role = 'USER' } = req.body;
    const targetRole = role;

    if (!['SUPER_ADMIN', 'ADMIN', 'USER'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified' });
    }

    if (isSuperAdminRole(targetRole) && !isSuperAdminRole(req.user.role)) {
      return res.status(403).json({ message: 'Only a Super Admin can invite a Super Admin' });
    }

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const token = crypto.randomBytes(32).toString('hex');

    const registerLink = `${clientUrl}/register?token=${token}`;

    await sendMail({
      to: email,
      subject: "You're invited to join Vaultix",
      html: renderEmail({
        title: "You've been invited to Vaultix",
        body: `Your organization is using <strong>Vaultix Enterprise</strong> to manage shared passwords, sensitive credentials, and secrets with zero-knowledge encryption.<br><br>Click the button below to accept your invitation and activate your account.`,
        buttonText: 'Accept Invitation &rarr;',
        buttonUrl: registerLink,
        accent: 'purple',
        badge: 'TEAM INVITATION',
        icon: '🤝',
        recipientEmail: email,
        extraHtml: `
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 16px;background-color:#faf5ff;border-left:4px solid #7c3aed;border-top:1px solid #e9d5ff;border-right:1px solid #e9d5ff;border-bottom:1px solid #e9d5ff;border-radius:10px">
            <tr>
              <td style="padding:14px 18px" align="left">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#7c3aed;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding-bottom:6px" align="left">
                      Invitation Details
                    </td>
                  </tr>
                  <tr>
                    <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12.5px;color:#4a044e;line-height:1.7" align="left">
                      <strong>Invited Email:</strong> ${email}<br>
                      <strong>Assigned Role:</strong> <span style="display:inline-block;padding:2px 8px;background-color:#f3e8ff;border:1px solid #d8b4fe;border-radius:6px;font-weight:700;color:#6b21a8;font-size:11px">${targetRole}</span><br>
                      <strong>Security Standard:</strong> AES-256-GCM / RSA-4096 End-to-End
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        `,
        footerNote: `This invitation was issued for <strong>${email}</strong> and expires in 7 days. If you were not expecting this invite, you can safely ignore this email.`,
      }),
    });

    const invitation = await prisma.invitation.create({
      data: {
        id: await generateId('invitation'),
        email,
        token,
        role: targetRole,
        invitedBy: req.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.status(201).json({
      message: 'Invitation sent successfully',
      invitation,
    });
  } catch (error) {
    console.error('Send invitation error:', error);
    const isAuthError = error?.code === 'EAUTH';
    res.status(500).json({
      message: isAuthError
        ? 'Email sending failed: invalid Gmail credentials. Use a 16-character App Password (myaccount.google.com/apppasswords).'
        : 'Failed to send invitation',
    });
  }
};

const getInvitationByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation || invitation.isUsed) {
      return res.status(404).json({ message: 'Invalid invitation' });
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      return res.status(400).json({ message: 'Invitation expired' });
    }

    res.json({
      email: invitation.email,
      role: invitation.role,
    });
  } catch (error) {
    console.error('Get invitation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getPendingInvitations = async (req, res) => {
  try {
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        inviter: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    res.json(invitations);
  } catch (error) {
    console.error('Get pending invitations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  sendInvitation,
  getInvitationByToken,
  getPendingInvitations,
};

