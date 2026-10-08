const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');

const { globalLimiter } = require('./utils/rateLimiters');

const authRoutes = require('./routes/authRoutes');
const vaultRoutes = require('./routes/vaultRoutes');
const passwordRoutes = require('./routes/passwordRoutes');
const activityRoutes = require('./routes/activityRoutes');
const userRoutes = require('./routes/userRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const folderRoutes = require('./routes/folderRoutes');
const invitationRoutes = require('./routes/invitationRoutes');
const personalVaultRoutes = require('./routes/personalVaultRoutes');
const passwordShareRoutes = require('./routes/passwordShareRoutes');
const loginActivityRoutes = require('./routes/loginActivityRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const keyPairRoutes = require('./routes/keyPairRoutes');
const twoFactorRoutes = require('./routes/twoFactorRoutes');
const passwordHealthRoutes = require('./routes/passwordHealthRoutes');
const sessionRoutes = require('./routes/sessionRoutes');

const app = express();

app.disable('x-powered-by');

// When running behind a trusted reverse proxy (docker/production), honor the
// real client IP for rate-limiting and audit logs. Set TRUST_PROXY=true.
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    contentSecurityPolicy: {
      directives: {
        // The API only returns JSON, so forbid loading any content.
        defaultSrc: ["'none'"],
        frameAncestors: ["'self'", "https://www.karnsphere.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  })
);

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : ':method :url :status :response-time ms'));

const clientOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: clientOrigins.length > 1 ? clientOrigins : clientOrigins[0],
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  })
);

app.use(cookieParser());

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ message: 'API is running' });
});

app.use('/api', globalLimiter);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/vaults', vaultRoutes);
app.use('/api/v1/passwords', passwordRoutes);
app.use('/api/v1/activity', activityRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/folders', folderRoutes);
app.use('/api/v1/invitations', invitationRoutes);
app.use('/api/v1/my-vault', personalVaultRoutes);
app.use('/api/v1/password-shares', passwordShareRoutes);
app.use('/api/v1/login-activity', loginActivityRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/keypair', keyPairRoutes);
app.use('/api/v1/2fa', twoFactorRoutes);
app.use('/api/v1/password-health', passwordHealthRoutes);
app.use('/api/v1/sessions', sessionRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

module.exports = app;
