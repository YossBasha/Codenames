const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
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

// AutoUpdater Setup
autoUpdater.logger = { log: console.log, info: console.log, error: console.error, warn: console.log };
autoUpdater.autoDownload = false; // We'll manually trigger download to show progress

autoUpdater.on('update-available', (info) => {
  console.log('[Updater] Update available:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('updater:available', info.version);
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
  console.log('[Updater] Update downloaded');
  if (mainWindow) {
    mainWindow.webContents.send('updater:downloaded');
  }
});

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

  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.error('Failed to check for updates on startup:', err);
      });
    }, 5000);
  }
});

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
ipcMain.handle('download-update', async () => {
  if (app.isPackaged) {
    autoUpdater.downloadUpdate();
  }
});
ipcMain.handle('install-update', () => {
  if (app.isPackaged) {
    autoUpdater.quitAndInstall();
  }
});
ipcMain.handle('relaunch-app', () => {
  app.relaunch();
  app.exit(0);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  // The embedded express server keeps the event loop alive.
  // We must forcefully exit so the updater can overwrite the files.
  console.log('App quitting, forcing exit(0) to terminate embedded server');
  app.exit(0);
});
