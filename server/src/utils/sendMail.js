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

const transporter = createTransporter();

const sendMail = async ({ to, subject, html }) => {
  const fromAddress = process.env.MAIL_FROM || `"Vaultix" <${mailUser}>`;
  await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
  });
};

module.exports = sendMail;