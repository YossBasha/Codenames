import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupRoomManager, getPublicRooms } from './socket/roomManager';
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
}

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
