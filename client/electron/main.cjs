const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const https = require('https');
const { autoUpdater } = require('electron-updater');

// Setup file logging
const logFile = path.join(app.getPath('userData'), 'app-debug.log');
const logStream = fs.createWriteStream(logFile, { flags: 'w' });
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
let serverPort = null;
const SERVER_PORT = 3000;

// =============================================================================
// Lightweight Patch Updater
// =============================================================================
// Instead of downloading the full 182 MB NSIS installer for every code change,
// we download a small ~12 MB app-patch.zip that contains only app.asar and
// server/dist, then replace them in-place and relaunch.
// =============================================================================

const GITHUB_OWNER = 'YossBasha';
const GITHUB_REPO = 'Codenames';

// Track update state
let pendingUpdateVersion = null;
let patchReady = false;     // true when patch has been downloaded & extracted, ready to install
let fullUpdateReady = false; // true when electron-updater downloaded the full NSIS installer
let isUpdating = false;      // prevent concurrent updates

/**
 * Follow GitHub redirects and download the final file as a Buffer.
 * Returns a Promise<Buffer>.
 */
function downloadGithubAsset(url) {
  return new Promise((resolve, reject) => {
    const doRequest = (currentUrl, redirectCount) => {
      if (redirectCount > 5) return reject(new Error('Too many redirects'));

      const parsed = new URL(currentUrl);
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: { 'User-Agent': 'Codenames-Updater' }
      };

      https.get(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doRequest(res.headers.location, redirectCount + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} fetching ${currentUrl}`));
        }

        const totalBytes = parseInt(res.headers['content-length'], 10) || 0;
        const chunks = [];
        let downloadedBytes = 0;
        let lastReportedPercent = -1;

        res.on('data', (chunk) => {
          chunks.push(chunk);
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const percent = Math.round((downloadedBytes / totalBytes) * 100);
            if (percent !== lastReportedPercent) {
              lastReportedPercent = percent;
              if (mainWindow) {
                mainWindow.webContents.send('updater:progress', percent);
              }
            }
          }
        });

        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    };

    doRequest(url, 0);
  });
}

/**
 * Download app-patch.zip from the GitHub release, extract it, and stage the
 * files ready to be applied on next relaunch.
 */
async function downloadAndApplyPatch(version) {
  if (isUpdating) {
    console.log('[Patch] Already updating, skipping');
    return false;
  }
  isUpdating = true;

  const patchUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${version}/app-patch.zip`;
  console.log('[Patch] Downloading patch from:', patchUrl);

  try {
    if (mainWindow) {
      mainWindow.webContents.send('updater:progress', 0);
    }

    // Download the zip
    const zipBuffer = await downloadGithubAsset(patchUrl);
    console.log(`[Patch] Downloaded ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Extract to a staging directory
    const stagingDir = path.join(app.getPath('userData'), 'patch-staging');
    if (fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
    fs.mkdirSync(stagingDir, { recursive: true });

    // Use adm-zip to extract
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(stagingDir, true);

    console.log('[Patch] Extracted to staging:', stagingDir);

    // Now apply: replace app.asar and server/dist in the install directory
    const resourcesDir = process.resourcesPath; // e.g. C:\Users\...\AppData\Local\Programs\codenames\resources

    // Replace app.asar
    const stagedAsar = path.join(stagingDir, 'app.asar');
    const targetAsar = path.join(resourcesDir, 'app.asar');
    if (fs.existsSync(stagedAsar)) {
      // Backup existing app.asar
      const backupAsar = targetAsar + '.bak';
      try { fs.copyFileSync(targetAsar, backupAsar); } catch (e) { /* ok if missing */ }
      fs.copyFileSync(stagedAsar, targetAsar);
      console.log('[Patch] Replaced app.asar');
    }

    // Replace server/dist
    const stagedServerDist = path.join(stagingDir, 'server-dist');
    const targetServerDist = path.join(resourcesDir, 'server', 'dist');
    if (fs.existsSync(stagedServerDist)) {
      // Backup existing server/dist
      const backupServerDist = targetServerDist + '.bak';
      try {
        if (fs.existsSync(backupServerDist)) {
          fs.rmSync(backupServerDist, { recursive: true, force: true });
        }
        fs.cpSync(targetServerDist, backupServerDist, { recursive: true });
      } catch (e) { /* ok if missing */ }

      // Remove old and copy new
      fs.rmSync(targetServerDist, { recursive: true, force: true });
      fs.cpSync(stagedServerDist, targetServerDist, { recursive: true });
      console.log('[Patch] Replaced server/dist');
    }

    // Clean up staging
    fs.rmSync(stagingDir, { recursive: true, force: true });

    pendingUpdateVersion = version;
    patchReady = true;
    isUpdating = false;

    console.log('[Patch] Patch applied successfully for version', version);

    if (mainWindow) {
      mainWindow.webContents.send('updater:downloaded');
    }

    return true;
  } catch (err) {
    console.error('[Patch] Patch download/apply failed:', err.message);
    isUpdating = false;
    return false;
  }
}

// =============================================================================
// Firewall & Window
// =============================================================================

function ensureFirewallRule() {
  if (process.platform !== 'win32') return;
  const ruleNameTCP = 'Codenames Duet Server TCP';
  const ruleNameUDP = 'Codenames Duet Discovery UDP';
  const cmdTCP = `netsh advfirewall firewall add rule name="${ruleNameTCP}" dir=in action=allow protocol=TCP localport=${SERVER_PORT} profile=private,domain,public 2>nul`;
  const cmdUDP = `netsh advfirewall firewall add rule name="${ruleNameUDP}" dir=in action=allow protocol=UDP localport=41234 profile=private,domain,public 2>nul`;
  exec(cmdTCP, () => {});
  exec(cmdUDP, () => {
    console.log(`[Firewall] UDP discovery port 41234 allowance script executed`);
  });
}

function createWindow() {
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
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }
}

// =============================================================================
// AutoUpdater Setup (Full Installer — used as fallback only)
// =============================================================================
autoUpdater.logger = { log: console.log, info: console.log, error: console.error, warn: console.log };
autoUpdater.autoDownload = false;

// When electron-updater detects an update, we intercept and try the lightweight
// patch first. If that fails, we fall back to the full NSIS download.
autoUpdater.on('update-available', async (info) => {
  const version = info.version;
  console.log('[Updater] Update available:', version);
  pendingUpdateVersion = version;

  if (mainWindow) {
    mainWindow.webContents.send('updater:available', version);
  }

  // Automatically try the lightweight patch in the background
  console.log('[Patch] Attempting lightweight patch download for', version);
  const patchSuccess = await downloadAndApplyPatch(version);

  if (!patchSuccess) {
    // Fallback: download the full NSIS installer
    console.log('[Updater] Patch failed, falling back to full installer download');
    if (mainWindow) {
      mainWindow.webContents.send('updater:progress', 0);
    }
    autoUpdater.downloadUpdate();
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[Updater] Update not available');
  if (mainWindow) {
    mainWindow.webContents.send('updater:not-available');
  }
});

autoUpdater.on('error', (err) => {
  console.error('[Updater] Error in auto-updater:', err);
  if (mainWindow) {
    mainWindow.webContents.send('updater:error', err.toString());
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  console.log('[Updater]', log_message);
  if (mainWindow) {
    mainWindow.webContents.send('updater:progress', progressObj.percent);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[Updater] Full update downloaded');
  fullUpdateReady = true;
  if (mainWindow) {
    mainWindow.webContents.send('updater:downloaded');
  }
});

// =============================================================================
// App Lifecycle
// =============================================================================

app.whenReady().then(() => {
  ensureFirewallRule();

  const isDev = !app.isPackaged;
  let serverPath;

  if (isDev) {
    serverPath = path.join(app.getAppPath(), '..', 'server', 'dist', 'server', 'src', 'index.js');
  } else {
    serverPath = path.join(process.resourcesPath, 'server', 'dist', 'server', 'src', 'index.js');
  }

  console.log('Starting server inside main process at:', serverPath);
  
  if (!isDev) {
    const nodeModulesPath = path.join(process.resourcesPath, 'server', 'node_modules');
    process.env.NODE_PATH = nodeModulesPath;
    require('module').Module._initPaths();
  }

  process.env.PORT = String(SERVER_PORT);

  process.send = (msg) => {
    if (msg && msg.channel === 'server-port') {
      serverPort = msg.port;
      console.log('Embedded server running on port:', serverPort);
      createWindow();
    }
  };

  try {
    require(serverPath);
  } catch (err) {
    console.error('Failed to start server module:', err);
    dialog.showErrorBox('Server Start Failed', `Failed to start server: ${err.message}\n\nStack: ${err.stack}\n\nServerPath: ${serverPath}`);
  }

  // Auto-check for updates on launch (background, silent)
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.error('Failed to check for updates on startup:', err);
      });
    }, 5000);
  }
});

// =============================================================================
// IPC Handlers
// =============================================================================

ipcMain.handle('get-server-port', () => serverPort);

ipcMain.handle('check-for-updates', async () => {
  if (app.isPackaged) {
    try {
      await autoUpdater.checkForUpdates();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }
  return false;
});

// No longer needed — patches auto-download. Kept for compatibility.
ipcMain.handle('download-update', async () => {
  if (app.isPackaged && pendingUpdateVersion && !patchReady && !fullUpdateReady) {
    autoUpdater.downloadUpdate();
  }
});

ipcMain.handle('install-update', () => {
  if (!app.isPackaged) return;

  if (patchReady) {
    // Patch was applied in-place — just relaunch
    console.log('[Patch] Relaunching after in-place patch');
    app.relaunch();
    app.exit(0);
  } else if (fullUpdateReady) {
    // Full NSIS installer — use electron-updater's quitAndInstall
    console.log('[Updater] Installing full update via NSIS');
    autoUpdater.quitAndInstall();
    // Fallback: If electron fails to quit because of the embedded server,
    // forcefully kill the process after 3 seconds so the NSIS installer can proceed.
    setTimeout(() => {
      console.log('[Main] Forcing exit 3s after quitAndInstall to prevent zombie lock.');
      app.exit(0);
    }, 3000);
  }
});

// Force full update — bypasses the patch system and downloads the full NSIS installer
ipcMain.handle('force-full-update', async () => {
  if (!app.isPackaged) return false;

  patchReady = false;
  fullUpdateReady = false;
  isUpdating = false;

  try {
    const result = await autoUpdater.checkForUpdates();
    if (result && result.updateInfo) {
      console.log('[Updater] Force full update — downloading full installer for', result.updateInfo.version);
      if (mainWindow) {
        mainWindow.webContents.send('updater:available', result.updateInfo.version);
        mainWindow.webContents.send('updater:progress', 0);
      }
      autoUpdater.downloadUpdate();
      return true;
    }
    // No update available
    if (mainWindow) {
      mainWindow.webContents.send('updater:not-available');
    }
    return false;
  } catch (err) {
    console.error('[Updater] Force full update failed:', err);
    if (mainWindow) {
      mainWindow.webContents.send('updater:error', err.toString());
    }
    return false;
  }
});

ipcMain.handle('relaunch-app', () => {
  app.relaunch();
  app.exit(0);
});

// =============================================================================
// Window Close / Quit
// =============================================================================

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  // The embedded express server keeps the event loop alive.
  // We must forcefully exit so the updater can overwrite the files.
  console.log('App quitting, forcing exit(0) to terminate embedded server');
  app.exit(0);
});
