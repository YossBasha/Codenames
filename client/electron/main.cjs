const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fork, exec } = require('child_process');
const https = require('https');
const fs = require('fs');
const AdmZip = require('adm-zip');
const DiscordRPC = require('discord-rpc');
const { autoUpdater } = require('electron-updater');

app.setAsDefaultProtocolClient('codenames');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', (event, commandLine, workingDirectory) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    const url = commandLine.find(arg => arg.startsWith('codenames://'));
    if (url) {
      mainWindow.webContents.send('deep-link', url);
    }
  }
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.webContents.send('deep-link', url);
  } else {
    app.whenReady().then(() => {
      // Small delay to ensure window is fully initialized before sending IPC
      setTimeout(() => {
        if (mainWindow) mainWindow.webContents.send('deep-link', url);
      }, 1000);
    });
  }
});

const discordClientId = '1518219109299519538';
let rpcClient;

function initDiscord() {
  try {
    DiscordRPC.register(discordClientId);
    rpcClient = new DiscordRPC.Client({ transport: 'ipc' });
    rpcClient.on('ready', () => {
      console.log('[Discord] Authed for user', rpcClient.user.username);
    });
    rpcClient.login({ clientId: discordClientId }).catch(err => {
      console.log('[Discord] Could not connect to Discord:', err.message);
    });
  } catch (err) {
    console.log('[Discord] Setup failed:', err.message);
  }
}

// Setup file logging to help debug server/ngrok issues in packaged app
const logFile = path.join(app.getPath('userData'), 'app-debug.log');
const logStream = fs.createWriteStream(logFile, { flags: 'w' }); // overwrite each launch
console.log = (...args) => {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  logStream.write(`[LOG] ${new Date().toISOString()}: ${msg}\n`);
  process.stdout.write(msg + '\n');
};
console.error = (...args) => {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  logStream.write(`[ERROR] ${new Date().toISOString()}: ${msg}\n`);
  process.stderr.write(msg + '\n');
};

console.log('[Main] Logger initialized. Log file path:', logFile);

let mainWindow;
let serverProcess;
let serverPort = null;

const SERVER_PORT = 3000;

// Add Windows Firewall inbound rule for the server port and UDP discovery port (silent — fails gracefully if no admin)
function ensureFirewallRule() {
  if (process.platform !== 'win32') return;
  const ruleNameTCP = 'Codenames Duet Server TCP';
  const ruleNameUDP = 'Codenames Duet Discovery UDP';
  
  const cmdTCP = `netsh advfirewall firewall add rule name="${ruleNameTCP}" dir=in action=allow protocol=TCP localport=${SERVER_PORT} profile=private,domain,public 2>nul`;
  const cmdUDP = `netsh advfirewall firewall add rule name="${ruleNameUDP}" dir=in action=allow protocol=UDP localport=41234 profile=private,domain,public 2>nul`;
  
  const { exec } = require('child_process');
  exec(cmdTCP, () => {});
  exec(cmdUDP, () => {
    console.log(`[Firewall] UDP discovery port 41234 allowance script executed`);
  });
}

function getLocalCoreVersion() {
  try {
    const pkgPath = path.join(app.getAppPath(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.coreVersion || '1.0.0';
  } catch (e) {
    return '1.0.0';
  }
}

function getLocalRunningVersion() {
  const updatesDir = path.join(app.getPath('userData'), 'updates');
  const updatePkgPath = path.join(updatesDir, 'Codenames-dist-files', 'package.json');
  if (fs.existsSync(updatePkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(updatePkgPath, 'utf8'));
      if (pkg && pkg.version) return pkg.version;
    } catch (_) {}
  }
  return app.getVersion();
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Codenames-App' }, timeout: 3000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Status ${res.statusCode}`));
        return;
      }
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'Codenames-App' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download: ${res.statusCode}`));
        return;
      }
      const fileStream = fs.createWriteStream(dest);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      fileStream.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });
    request.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

async function checkAndApplyUpdates(force = false) {
  if (!app.isPackaged && !force) {
    console.log('[Updater] Dev mode: Skipping update check.');
    return { type: 'none' };
  }
  try {
    console.log('[Updater] Checking for updates...');
    const remotePkg = await fetchJson('https://raw.githubusercontent.com/YossBasha/Codenames/main/client/package.json');
    const remoteVersion = remotePkg.version;
    const remoteCoreVersion = remotePkg.coreVersion || '1.0.0';
    
    const localVersion = getLocalRunningVersion();
    const localCoreVersion = getLocalCoreVersion();
    
    console.log(`[Updater] Local version: ${localVersion} (Core: ${localCoreVersion}), Remote version: ${remoteVersion} (Core: ${remoteCoreVersion})`);
    
    if (compareVersions(remoteCoreVersion, localCoreVersion) > 0) {
      console.log('[Updater] Core update detected!');
      return { type: 'core' };
    }
    
    if (compareVersions(remoteVersion, localVersion) > 0) {
      console.log('[Updater] New version detected! Downloading update zip...');
      const updatesDir = path.join(app.getPath('userData'), 'updates');
      if (!fs.existsSync(updatesDir)) {
        fs.mkdirSync(updatesDir, { recursive: true });
      }
      const zipPath = path.join(updatesDir, 'update.zip');
      
      await downloadFile('https://codeload.github.com/YossBasha/Codenames/zip/refs/heads/dist-files', zipPath);
      console.log('[Updater] Download complete. Extracting zip...');
      
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(updatesDir, true);
      fs.unlinkSync(zipPath);
      
      console.log('[Updater] Update applied successfully!');
      return { type: 'hot-swap' };
    } else {
      console.log('[Updater] App is up to date.');
    }
  } catch (err) {
    console.error('[Updater] Update check failed:', err);
  }
  return { type: 'none' };
}

function createWindow(customClientHtmlPath) {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'electron', 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const htmlPath = customClientHtmlPath || path.join(app.getAppPath(), 'dist', 'index.html');
    mainWindow.loadFile(htmlPath);
  }
}

app.whenReady().then(async () => {
  ensureFirewallRule();
  initDiscord();

  // Try checking and applying code updates
  await checkAndApplyUpdates();

  // Determine paths to run server and client
  const updatesDir = path.join(app.getPath('userData'), 'updates');
  const updatedServerPath = path.join(updatesDir, 'Codenames-dist-files', 'server', 'dist', 'server', 'src', 'index.js');
  const updatedClientHtmlPath = path.join(updatesDir, 'Codenames-dist-files', 'client', 'dist', 'index.html');

  const isDev = !app.isPackaged;
  let serverPath;
  let clientHtmlPath;

  if (isDev) {
    serverPath = path.join(app.getAppPath(), '..', 'server', 'dist', 'server', 'src', 'index.js');
    clientHtmlPath = null;
  } else {
    if (fs.existsSync(updatedServerPath) && fs.existsSync(updatedClientHtmlPath)) {
      console.log('[Updater] Loading updated server and client from:', updatesDir);
      serverPath = updatedServerPath;
      clientHtmlPath = updatedClientHtmlPath;
    } else {
      console.log('[Updater] Loading default packaged server and client');
      serverPath = path.join(process.resourcesPath, 'server', 'dist', 'server', 'src', 'index.js');
      clientHtmlPath = path.join(app.getAppPath(), 'dist', 'index.html');
    }
  }

  console.log('Starting server inside main process at:', serverPath);
  
  // Try to load WAN_SERVER_URL from client/.env for local testing
  try {
    const envPath = path.join(app.getAppPath(), '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/^VITE_WAN_SERVER_URL=(.*)$/m);
      if (match) {
        process.env.WAN_SERVER_URL = match[1].trim();
        console.log('[Main] Loaded WAN_SERVER_URL from .env:', process.env.WAN_SERVER_URL);
      }
    }
  } catch (e) {
    console.error('Failed to read .env file for WAN_SERVER_URL', e);
  }

  process.env.PORT = String(SERVER_PORT);

  process.send = (msg) => {
    if (msg && msg.channel === 'server-port') {
      serverPort = msg.port;
      console.log('Embedded server running on port:', serverPort);
      createWindow(clientHtmlPath);
    }
  };

  try {
    require(serverPath);
  } catch (err) {
    console.error('Failed to start server module:', err);
    // Fall back to packaged version if custom one fails
    if (!isDev && serverPath !== path.join(process.resourcesPath, 'server', 'dist', 'server', 'src', 'index.js')) {
      console.log('[Updater] Falling back to packaged server...');
      serverPath = path.join(process.resourcesPath, 'server', 'dist', 'server', 'src', 'index.js');
      try {
        require(serverPath);
      } catch (e) {
        console.error('Packaged server fallback failed:', e);
      }
    }
  }
});

  ipcMain.handle('get-server-port', () => serverPort);
  ipcMain.handle('check-for-updates', async (event, force) => {
    return await checkAndApplyUpdates(force);
  });
  ipcMain.handle('relaunch-app', () => {
    app.relaunch();
    app.exit(0);
  });

  autoUpdater.autoDownload = false;
  let downloadPromise = null;
  
  ipcMain.handle('download-core-update', () => {
    if (downloadPromise) return downloadPromise;
    downloadPromise = new Promise((resolve, reject) => {
      autoUpdater.downloadUpdate().catch(err => {
        downloadPromise = null;
        reject(err);
      });
      autoUpdater.once('update-downloaded', () => {
        downloadPromise = null;
        resolve(true);
      });
      autoUpdater.on('download-progress', (progressObj) => {
        if (mainWindow) {
          mainWindow.webContents.send('core-update-progress', progressObj.percent);
        }
      });
      autoUpdater.on('error', (err) => {
        downloadPromise = null;
        reject(err);
      });
    });
    return downloadPromise;
  });

  ipcMain.on('install-core-update', () => {
    autoUpdater.quitAndInstall();
  });

ipcMain.on('set-discord-activity', (event, activity) => {
  if (rpcClient && rpcClient.user) {
    rpcClient.setActivity({
      ...activity,
      largeImageKey: activity.largeImageKey || 'logo',
      largeImageText: 'Codenames',
      instance: false,
    }).catch(console.error);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});



