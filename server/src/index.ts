// --- LEGACY UPDATER PATCH ---
// The v1.14.21 client has a bug where it fails to set NODE_PATH before requiring the updated server.
// To allow old executables to update seamlessly, we inject the node_modules path here before any other imports.
if ((process as any).resourcesPath) {
  const _path = require('path');
  const nodeModulesPath = _path.join((process as any).resourcesPath, 'server', 'node_modules');
  if (process.env.NODE_PATH !== nodeModulesPath) {
    process.env.NODE_PATH = nodeModulesPath;
    require('module').Module._initPaths();
  }
}
// ----------------------------

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { setupRoomManager, getPublicRooms, getLocalRoomsForRegistration, registerRooms } from './socket/roomManager';
import { startBroadcasting, stopBroadcasting, startListening, stopListening, getDiscoveredRooms, getLocalIPAddress, getHostingInfo } from './discovery';
import { loadEmbeddings } from './utils/aiLogic';

loadEmbeddings();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 5e6, // 5 MB — needed for large base64 avatars
});

app.get('/health', (req, res) => {
  res.send('Server is healthy');
});

app.get('/api/local-ip', (req, res) => {
  res.json({ ip: getLocalIPAddress() });
});

// Discovery API
app.post('/api/discovery/start-host', (req, res) => {
  const { roomID, hostName, port, hostIP } = req.body;
  if (!roomID || !hostName || !port) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  startBroadcasting(roomID, hostName, port, hostIP);
  res.json({ success: true });
});

app.post('/api/discovery/stop-host', (req, res) => {
  stopBroadcasting();
  res.json({ success: true });
});

app.post('/api/discovery/start-listen', (req, res) => {
  startListening();
  res.json({ success: true });
});

app.post('/api/discovery/stop-listen', (req, res) => {
  stopListening();
  res.json({ success: true });
});

app.get('/api/discovery/rooms', (req, res) => {
  res.json({ rooms: getDiscoveredRooms() });
});

// WAN Public Rooms API
app.get('/api/public-rooms', (req, res) => {
  res.json({ rooms: getPublicRooms() });
});

// Ngrok status helper
async function getNgrokUrl(): Promise<string | null> {
  try {
    const res = await fetch('http://127.0.0.1:4040/api/tunnels');
    if (!res.ok) return null;
    const data = await res.json() as any;
    if (data && Array.isArray(data.tunnels) && data.tunnels.length > 0) {
      const httpsTunnel = data.tunnels.find((t: any) => t.proto === 'https' || t.public_url?.startsWith('https'));
      if (httpsTunnel) {
        return httpsTunnel.public_url;
      }
      return data.tunnels[0].public_url;
    }
  } catch (e) {
    // Ngrok is not running locally
  }
  return null;
}

app.get('/api/ngrok-status', async (req, res) => {
  const url = await getNgrokUrl();
  res.json({ active: !!url, publicUrl: url });
});

app.post('/api/public-rooms/register', (req, res) => {
  const { serverUrl, rooms } = req.body;
  if (!serverUrl || !Array.isArray(rooms)) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  registerRooms(serverUrl, rooms);
  res.json({ success: true });
});

// Periodic local room registration heartbeat (for local hosting servers with active ngrok)
const WAN_SERVER_URL = process.env.WAN_SERVER_URL || 'https://codenamesserver-bfmmt2mx.b4a.run';

setInterval(async () => {
  try {
    const ngrokUrl = await getNgrokUrl();
    if (ngrokUrl) {
      // Don't register with ourselves if we are the central server
      const localRooms = getLocalRoomsForRegistration();
      await fetch(`${WAN_SERVER_URL}/api/public-rooms/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl: ngrokUrl,
          rooms: localRooms
        }),
        signal: AbortSignal.timeout(3000)
      });
    }
  } catch (e) {
    console.error('[Ngrok-Register] Registration failed:', e);
  }
}, 5000);


// HTTP-based discovery: joiners probe this endpoint on candidate IPs
app.get('/api/discovery/hosting', (req, res) => {
  const info = getHostingInfo();
  if (info) {
    res.json({ hosting: true, ...info });
  } else {
    res.json({ hosting: false });
  }
});

setupRoomManager(io);

let PORT = parseInt(process.env.PORT || '3000', 10);

// Store actual port so it can be polled via HTTP as a fallback
let actualServerPort = 0;

app.get('/api/port', (_req, res) => {
  res.json({ port: actualServerPort });
});

function notifyPort(port: number) {
  actualServerPort = port;

  // Electron: child_process IPC
  if (typeof process.send === 'function') {
    process.send({ channel: 'server-port', port });
  }

  // Capacitor nodejs bridge IPC
  try {
    const bridge = require('bridge');
    bridge.channel.send('server-port', { port });
  } catch (_) {
    // Not running inside Capacitor nodejs — ignore
  }

  startNgrok(port);
}

let ngrokProcess: any = null;

function shouldLaunchNgrok() {
  const triggerFileName = 'launch-ngrok.txt';
  const pathsToCheck = [
    'c:/Users/yossu/OneDrive/Desktop/Programing/Games/Codenames/client/launch-ngrok.txt',
    path.join(__dirname, '..', triggerFileName),
    path.join(__dirname, '..', '..', triggerFileName),
    path.join(__dirname, '..', '..', 'client', triggerFileName),
    path.join(path.dirname(process.execPath), triggerFileName),
    path.join(path.dirname(process.execPath), '..', '..', triggerFileName),
    path.join(path.dirname(process.execPath), '..', '..', 'client', triggerFileName),
    path.join(process.cwd(), triggerFileName),
    path.join(process.cwd(), 'client', triggerFileName)
  ];
  
  console.log('[Ngrok] Checking paths for auto-launch trigger file:');
  for (const p of pathsToCheck) {
    try {
      const exists = fs.existsSync(p);
      console.log(`  - ${p}: ${exists ? 'FOUND' : 'NOT FOUND'}`);
      if (exists) return true;
    } catch (e) {
      console.log(`  - ${p}: ERROR checking (${e})`);
    }
  }
  return false;
}

function startNgrok(port: number) {
  if (!shouldLaunchNgrok()) {
    console.log('[Ngrok] launch-ngrok.txt not found. Skipping ngrok launch.');
    return;
  }

  console.log(`[Ngrok] launch-ngrok.txt found! Starting ngrok tunnel on port ${port}...`);
  try {
    ngrokProcess = spawn('ngrok', ['http', String(port)], {
      shell: true,
      detached: false
    });

    ngrokProcess.on('error', (err: any) => {
      console.error('[Ngrok] Failed to start ngrok process:', err);
    });
  } catch (err) {
    console.error('[Ngrok] Exception spawning ngrok:', err);
  }
}

function killNgrok() {
  if (ngrokProcess) {
    console.log('[Ngrok] Terminating ngrok process...');
    try {
      if (process.platform === 'win32') {
        const { exec } = require('child_process');
        exec(`taskkill /pid ${ngrokProcess.pid} /T /F`, () => {});
      } else {
        ngrokProcess.kill();
      }
    } catch (e) {
      // Ignore
    }
    ngrokProcess = null;
  }
}

process.on('exit', killNgrok);
process.on('SIGINT', () => { killNgrok(); process.exit(); });
process.on('SIGTERM', () => { killNgrok(); process.exit(); });

function startServer(port: number) {
  server.listen(port, '0.0.0.0', () => {
    const ap = (server.address() as any)?.port || port;
    console.log(`Server listening on port ${ap}`);
    notifyPort(ap);
  }).on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', e);
    }
  });
}

startServer(PORT);

