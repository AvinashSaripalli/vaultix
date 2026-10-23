const nodemailer = require('nodemailer');

const mailUser = (process.env.MAIL_USER || '').trim();
const mailHost = (process.env.MAIL_HOST || '').trim();

const isMicrosoft =
  process.env.MAIL_SERVICE === 'office365' ||
  process.env.MAIL_SERVICE === 'microsoft' ||
  mailHost.includes('office365') ||
  mailHost.includes('outlook') ||
  mailUser.toLowerCase().endsWith('@knadvisors.pro');

function createTransporter() {
  if (mailHost) {
    return nodemailer.createTransport({
      host: mailHost,
      port: parseInt(process.env.MAIL_PORT, 10) || 587,
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: mailUser,
        pass: process.env.MAIL_PASS,
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false,
      },
    });
  }

  if (isMicrosoft) {
    return nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false, // STARTTLS
      auth: {
        user: mailUser,
        pass: process.env.MAIL_PASS,
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false,
      },
    });
  }

  return nodemailer.createTransport({
    service: process.env.MAIL_SERVICE || 'gmail',
    auth: {
      user: mailUser,
      pass: process.env.MAIL_PASS,
    },
  });
}

const path = require('path');
const fs = require('fs');

const transporter = createTransporter();
const logoPath = path.join(__dirname, '../assets/vaultix-logo.png');

const sendMail = async ({ to, subject, html, attachments = [] }) => {
  const fromAddress = process.env.MAIL_FROM || `"Vaultix" <${mailUser}>`;
  
  const mailAttachments = [];
  if (fs.existsSync(logoPath)) {
    mailAttachments.push({
      filename: 'vaultix-logo.png',
      path: logoPath,
      cid: 'vaultix-logo',
    });
  }
  if (Array.isArray(attachments) && attachments.length > 0) {
    mailAttachments.push(...attachments);
  }

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
    attachments: mailAttachments,
  });
};

module.exports = sendMail;