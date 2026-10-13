require('dotenv').config();
const net = require('net');
const fs = require('fs');
const { spawn } = require('child_process');
const app = require('./app');

const PORT = process.env.PORT || 4000;

function ensureLocalPostgres() {
  return new Promise((resolve) => {
    const pgCtl = 'D:\\pgsql\\bin\\pg_ctl.exe';
    const pgData = 'D:\\pgsql\\data';
    const pgLog = 'D:\\pgsql\\postgres.log';
    if (process.platform !== 'win32' || !fs.existsSync(pgCtl)) {
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
          // NOTE: Do NOT set `detached: true` on Windows — in Node/libuv,
          // `detached: true` uses DETACHED_PROCESS which overrides `windowsHide: true`
          // (CREATE_NO_WINDOW) and causes postgres worker processes to pop up
          // multiple console windows.
          const child = spawn(pgCtl, ['start', '-D', pgData, '-l', pgLog], {
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