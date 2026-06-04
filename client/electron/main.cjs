const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fork, exec } = require('child_process');

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

function createWindow() {
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

app.whenReady().then(() => {
  ensureFirewallRule();

  // Start Embedded Node Server
  const serverPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'server', 'dist', 'server', 'src', 'index.js')
    : path.join(app.getAppPath(), '..', 'server', 'dist', 'server', 'src', 'index.js');
    
  console.log('Starting server inside main process at:', serverPath);
  
  // Set the port in the environment so the server picks it up
  process.env.PORT = String(SERVER_PORT);

  // The server uses process.send to communicate the port back (for child_process IPC).
  // We mock it here so the server can still notify us when it's ready.
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
  }
});

ipcMain.handle('get-server-port', () => serverPort);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
