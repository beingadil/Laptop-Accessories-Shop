const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const http = require('node:http');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

let autoUpdater = null;
try {
  // Present only when the app is packaged — dev builds skip update checks.
  ({ autoUpdater } = require('electron-updater'));
} catch {
  autoUpdater = null;
}

let mainWindow = null;
let serverProcess = null;
let activePort = 3000;
let startupLogPath = null;

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')}`;
  try {
    if (!startupLogPath) {
      startupLogPath = path.join(app.getPath('userData'), 'logs', 'startup.log');
      fs.mkdirSync(path.dirname(startupLogPath), { recursive: true });
    }
    fs.appendFileSync(startupLogPath, line + '\n');
  } catch {
    // best effort
  }
  console.log(line);
}

function isDevMode() {
  return !app.isPackaged && process.env.ELECTRON_DEV === '1';
}

function findAvailablePort(preferred = 3456) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', () => {
      const fallback = net.createServer();
      fallback.listen(0, '127.0.0.1', () => {
        const addr = fallback.address();
        const port = typeof addr === 'object' && addr ? addr.port : 3457;
        fallback.close(() => resolve(port));
      });
    });
    srv.listen(preferred, '127.0.0.1', () => {
      srv.close(() => resolve(preferred));
    });
  });
}

let serverExited = null;
function waitForServer(url, timeoutMs = 90000) {
  const start = Date.now();
  serverExited = null;
  if (serverProcess) {
    serverProcess.once('exit', (code, signal) => {
      serverExited = { code, signal };
    });
  }
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (serverExited) {
        reject(
          new Error(
            `The local application server exited before it became ready ` +
              `(code ${serverExited.code ?? 'unknown'}${serverExited.signal ? `, signal ${serverExited.signal}` : ''}).\n\n` +
              `Details were written to:\n${startupLogPath}`
          )
        );
        return;
      }
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          log('server healthy after', Date.now() - start, 'ms');
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.setTimeout(1500, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (serverExited) {
        attempt();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(
          new Error(
            `Timed out waiting for the local application server to start.\n\n` +
              `This is usually antivirus or SmartScreen scanning the fresh install (everything is unsigned) ` +
              `or the local server failed silently.\n\n` +
              `Details were written to:\n${startupLogPath}`
          )
        );
      } else {
        setTimeout(attempt, 350);
      }
    };

    attempt();
  });
}

function ensurePersistentDatabase() {
  const userDataDir = app.getPath('userData');
  const dbDir = path.join(userDataDir, 'data');
  fs.mkdirSync(dbDir, { recursive: true });
  const targetDbPath = path.join(dbDir, 'tayyab-enterprises.db');

  if (!fs.existsSync(targetDbPath)) {
    log('first run: seeding database...');
    const seedCandidates = [
      path.join(process.resourcesPath || '', 'prisma', 'dev.db'),
      path.join(__dirname, '..', 'prisma', 'dev.db'),
    ];
    let copied = false;
    for (const src of seedCandidates) {
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, targetDbPath);
        log('seeded database from', src);
        copied = true;
        break;
      }
    }
    if (!copied) {
      log('WARNING: no seed database found — the embedded server will migrate an empty database');
    }
  } else {
    log('existing database found at', targetDbPath);
  }

  // Persist an offline installation secret for JWT session signing
  const secretPath = path.join(dbDir, '.auth-secret');
  let authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    if (fs.existsSync(secretPath)) {
      authSecret = fs.readFileSync(secretPath, 'utf8').trim();
    } else {
      authSecret = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(secretPath, authSecret, 'utf8');
    }
  }

  return { targetDbPath, authSecret };
}

async function startEmbeddedNextServer() {
  if (isDevMode()) {
    activePort = 3000;
    await waitForServer(`http://127.0.0.1:${activePort}/api/health`);
    return;
  }

  activePort = await findAvailablePort(3456);
  const { targetDbPath, authSecret } = ensurePersistentDatabase();

  const standaloneRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'standalone')
    : path.join(__dirname, '..', '.next', 'standalone');
  const serverEntry = path.join(standaloneRoot, 'server.js');

  if (!fs.existsSync(serverEntry)) {
    throw new Error(
      `Standalone Next.js server missing at ${serverEntry}. Run "npm run build" before packaging Electron.`
    );
  }

  if (!app.isPackaged) {
    const projectRoot = path.join(__dirname, '..');
    const staticSrc = path.join(projectRoot, '.next', 'static');
    const staticDest = path.join(standaloneRoot, '.next', 'static');
    if (fs.existsSync(staticSrc)) {
      fs.cpSync(staticSrc, staticDest, { recursive: true, force: true });
    }
    const publicSrc = path.join(projectRoot, 'public');
    const publicDest = path.join(standaloneRoot, 'public');
    if (fs.existsSync(publicSrc)) {
      fs.cpSync(publicSrc, publicDest, { recursive: true, force: true });
    }
  }

  log('spawning server:', serverEntry, 'on port', activePort);
  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: standaloneRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(activePort),
      HOSTNAME: '127.0.0.1',
      DATABASE_URL: `file:${targetDbPath}`,
      AUTH_SECRET: authSecret,
      APP_URL: `http://127.0.0.1:${activePort}`,
    },
    stdio: 'pipe',
  });

  log('database path:', targetDbPath);

  serverProcess.on('error', (err) => {
    log('server spawn ERROR:', err?.message || String(err));
  });
  serverProcess.on('exit', (code, signal) => {
    log('server EXITED:', JSON.stringify({ code, signal }));
  });
  serverProcess.stdout?.on('data', (chunk) => {
    log('[server]', String(chunk).trimEnd());
  });
  serverProcess.stderr?.on('data', (chunk) => {
    log('[server]', String(chunk).trimEnd());
  });

  await waitForServer(`http://127.0.0.1:${activePort}/api/health`);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1180,
    minHeight: 740,
    title: 'Tayyab Enterprises Management System',
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.maximize();
  mainWindow.loadURL(`http://127.0.0.1:${activePort}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`http://127.0.0.1:${activePort}`)) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Defence in depth: block navigation away from the embedded app origin entirely.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${activePort}`)) {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerUpdateHandlers() {
  const send = (payload) => {
    if (mainWindow) mainWindow.webContents.send('updater:status', payload);
  };

  if (autoUpdater) {
    autoUpdater.autoDownload = false; // user approves downloads
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => send({ state: 'checking' }));
    autoUpdater.on('update-available', (info) =>
      send({ state: 'available', version: info?.version })
    );
    autoUpdater.on('update-not-available', (info) =>
      send({ state: 'not-available', version: info?.version || app.getVersion() })
    );
    autoUpdater.on('error', (err) =>
      send({ state: 'error', message: err?.message || String(err) })
    );
    autoUpdater.on('download-progress', (p) =>
      send({ state: 'downloading', percent: Math.round(p?.percent ?? 0) })
    );
    autoUpdater.on('update-downloaded', (info) =>
      send({ state: 'downloaded', version: info?.version })
    );
  }

  ipcMain.handle('updater:check', async () => {
    if (!autoUpdater) return { supported: false, error: 'electron-updater not available.' };
    if (!app.isPackaged) {
      return { supported: false, error: 'Update checks only run in the packaged app.' };
    }
    try {
      await autoUpdater.checkForUpdates();
      return { supported: true };
    } catch (err) {
      return { supported: true, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('updater:download', async () => {
    if (!autoUpdater || !app.isPackaged) return { ok: false, error: 'Not available.' };
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('updater:install', () => {
    if (!autoUpdater) return { ok: false };
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  });
}

function registerIpcHandlers() {
  ipcMain.handle('tayyab:print', async () => {
    if (!mainWindow) return { ok: false };
    return new Promise((resolve) => {
      mainWindow.webContents.print({ silent: false, printBackground: true }, (success, reason) => {
        resolve({ ok: success, reason: reason || null });
      });
    });
  });

  ipcMain.handle('tayyab:save-backup', async (_event, payload) => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Database Backup',
      defaultPath: payload?.defaultFilename || 'tayyab-enterprises-backup.db',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    const buffer = Buffer.from(payload.base64Data, 'base64');
    fs.writeFileSync(result.filePath, buffer);
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle('tayyab:pick-backup', async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select SQLite Backup File',
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }],
    });
    if (result.canceled || !result.filePaths.length) return { canceled: true };
    const filePath = result.filePaths[0];
    const data = fs.readFileSync(filePath);
    return {
      canceled: false,
      filename: path.basename(filePath),
      base64Data: data.toString('base64'),
    };
  });

  ipcMain.handle('tayyab:info', () => {
    const userDataDir = app.getPath('userData');
    return {
      version: app.getVersion(),
      databasePath: path.join(userDataDir, 'data', 'tayyab-enterprises.db'),
    };
  });
}

app.whenReady().then(async () => {
  try {
    registerIpcHandlers();
    registerUpdateHandlers();
    await startEmbeddedNextServer();
    createMainWindow();

    // Packaged builds check for updates on startup (non-blocking).
    if (app.isPackaged && autoUpdater) {
      autoUpdater.checkForUpdates().catch(() => {});
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('startup failed:', message);
    dialog.showErrorBox(
      'Startup Error',
      `${message}${startupLogPath ? `\n\nDetails written to:\n${startupLogPath}` : ''}`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
