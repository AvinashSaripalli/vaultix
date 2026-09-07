const crypto = require('crypto');
const prisma = require('../config/prisma');
const generateId = require('../utils/generateId');
const sendMail = require('../utils/sendMail');
const { renderEmail } = require('../utils/emailTemplate');

const sendInvitation = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { email, role = 'USER' } = req.body;

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

    const registerLink = `${process.env.CLIENT_URL}/register?token=${token}`;

    await sendMail({
      to: email,
      subject: 'Vaultix Registration Invitation',
      html: renderEmail({
        title: 'You are invited to Vaultix',
        body: 'Your team is using Vaultix to keep shared credentials safe. Click the button below to create your account and set up your encrypted vault.',
        buttonText: 'Register Now',
        buttonUrl: registerLink,
        accent: 'purple',
        footerNote: `This invitation was sent to ${email} and expires in 7 days.`,
      }),
    });

    const invitation = await prisma.invitation.create({
      data: {
        id: await generateId('invitation'),
        email,
        token,
        role,
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
    if (req.user.role !== 'ADMIN') {
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

