require('dotenv').config();
const net = require('net');
const fs = require('fs');
const { spawn } = require('child_process');
const app = require('./app');

const PORT = process.env.PORT || 4000;

function ensureLocalPostgres() {
  return new Promise((resolve) => {
    const pgBin = 'D:\\pgsql\\bin\\postgres.exe';
    const pgData = 'D:\\pgsql\\data';
    if (process.platform !== 'win32' || !fs.existsSync(pgBin)) {
      return resolve();
    }

    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket
      .once('connect', () => {
        socket.destroy();
        resolve();
      })
      .once('error', () => {
        socket.destroy();
        console.log('Local PostgreSQL not listening on 5432 — starting D:\\pgsql...');
        try {
          const child = spawn(pgBin, ['-D', pgData], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
          });
          child.unref();
          setTimeout(resolve, 2500);
        } catch (err) {
          console.error('Failed to auto-start PostgreSQL:', err.message);
          resolve();
        }
      })
      .once('timeout', () => {
        socket.destroy();
        resolve();
      })
      .connect(5432, '127.0.0.1');
  });
}

ensureLocalPostgres().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});