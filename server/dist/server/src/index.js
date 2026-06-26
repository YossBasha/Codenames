"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const roomManager_1 = require("./socket/roomManager");
const discovery_1 = require("./discovery");
const aiLogic_1 = require("./utils/aiLogic");
(0, aiLogic_1.loadEmbeddings)();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 1e7,
});
app.get('/health', (req, res) => {
    res.send('Server is healthy');
});
// Serve the frontend UI
function getClientDistPath() {
    const paths = [
        path_1.default.join(__dirname, '..', '..', 'client', 'dist'), // dev ts-node
        path_1.default.join(__dirname, '..', '..', '..', '..', 'client', 'dist'), // prod dist folder
        path_1.default.join(__dirname, '..', '..', '..', '..', 'app', 'dist'), // packaged electron app
        path_1.default.join(process.cwd(), 'client', 'dist'),
        path_1.default.join(process.cwd(), 'dist'),
        path_1.default.join(path_1.default.dirname(process.execPath), 'resources', 'app', 'dist')
    ];
    for (const p of paths) {
        if (fs_1.default.existsSync(p))
            return p;
    }
    return null;
}
const clientDistPath = getClientDistPath();
if (clientDistPath) {
    app.use(express_1.default.static(clientDistPath));
}
app.get('/api/local-ip', (req, res) => {
    res.json({ ip: (0, discovery_1.getLocalIPAddress)() });
});
// Discovery API
app.post('/api/discovery/start-host', (req, res) => {
    const { roomID, hostName, port, hostIP } = req.body;
    if (!roomID || !hostName || !port) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }
    (0, discovery_1.startBroadcasting)(roomID, hostName, port, hostIP);
    res.json({ success: true });
});
app.post('/api/discovery/stop-host', (req, res) => {
    (0, discovery_1.stopBroadcasting)();
    res.json({ success: true });
});
app.post('/api/discovery/start-listen', (req, res) => {
    (0, discovery_1.startListening)();
    res.json({ success: true });
});
app.post('/api/discovery/stop-listen', (req, res) => {
    (0, discovery_1.stopListening)();
    res.json({ success: true });
});
app.get('/api/discovery/rooms', (req, res) => {
    res.json({ rooms: (0, discovery_1.getDiscoveredRooms)() });
});
// WAN Public Rooms API
app.get('/api/public-rooms', (req, res) => {
    res.json({ rooms: (0, roomManager_1.getPublicRooms)() });
});
// Ngrok status helper
async function getNgrokUrl() {
    try {
        const res = await fetch('http://127.0.0.1:4040/api/tunnels');
        if (!res.ok)
            return null;
        const data = await res.json();
        if (data && Array.isArray(data.tunnels) && data.tunnels.length > 0) {
            const httpsTunnel = data.tunnels.find((t) => t.proto === 'https' || t.public_url?.startsWith('https'));
            if (httpsTunnel) {
                return httpsTunnel.public_url;
            }
            return data.tunnels[0].public_url;
        }
    }
    catch (e) {
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
    (0, roomManager_1.registerRooms)(serverUrl, rooms);
    res.json({ success: true });
});
// Periodic local room registration heartbeat (for local hosting servers with active ngrok)
const WAN_SERVER_URL = process.env.WAN_SERVER_URL || 'https://premedical-dismally-tillie.ngrok-free.dev';
setInterval(async () => {
    try {
        const ngrokUrl = await getNgrokUrl();
        if (ngrokUrl) {
            // Don't register with ourselves if we are the central server
            const localRooms = (0, roomManager_1.getLocalRoomsForRegistration)();
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
    }
    catch (e) {
        console.error('[Ngrok-Register] Registration failed:', e);
    }
}, 5000);
// HTTP-based discovery: joiners probe this endpoint on candidate IPs
app.get('/api/discovery/hosting', (req, res) => {
    const info = (0, discovery_1.getHostingInfo)();
    if (info) {
        res.json({ hosting: true, ...info });
    }
    else {
        res.json({ hosting: false });
    }
});
(0, roomManager_1.setupRoomManager)(io);
let PORT = parseInt(process.env.PORT || '3000', 10);
// Store actual port so it can be polled via HTTP as a fallback
let actualServerPort = 0;
app.get('/api/port', (_req, res) => {
    res.json({ port: actualServerPort });
});
function notifyPort(port) {
    actualServerPort = port;
    // Electron: child_process IPC
    if (typeof process.send === 'function') {
        process.send({ channel: 'server-port', port });
    }
    // Capacitor nodejs bridge IPC
    try {
        const bridge = require('bridge');
        bridge.channel.send('server-port', { port });
    }
    catch (_) {
        // Not running inside Capacitor nodejs — ignore
    }
    startNgrok(port);
}
let ngrokProcess = null;
function shouldLaunchNgrok() {
    if (process.env.npm_lifecycle_event === 'dev' && process.cwd().replace(/\\/g, '/').endsWith('/server')) {
        console.log('[Ngrok] Auto-launching because of npm run dev in /server folder.');
        return true;
    }
    const triggerFileName = 'launch-ngrok.txt';
    const pathsToCheck = [
        'c:/Users/yossu/OneDrive/Desktop/Programing/Games/Codenames/client/launch-ngrok.txt',
        path_1.default.join(__dirname, '..', triggerFileName),
        path_1.default.join(__dirname, '..', '..', triggerFileName),
        path_1.default.join(__dirname, '..', '..', 'client', triggerFileName),
        path_1.default.join(path_1.default.dirname(process.execPath), triggerFileName),
        path_1.default.join(path_1.default.dirname(process.execPath), '..', '..', triggerFileName),
        path_1.default.join(path_1.default.dirname(process.execPath), '..', '..', 'client', triggerFileName),
        path_1.default.join(process.cwd(), triggerFileName),
        path_1.default.join(process.cwd(), 'client', triggerFileName)
    ];
    console.log('[Ngrok] Checking paths for auto-launch trigger file:');
    for (const p of pathsToCheck) {
        try {
            const exists = fs_1.default.existsSync(p);
            console.log(`  - ${p}: ${exists ? 'FOUND' : 'NOT FOUND'}`);
            if (exists)
                return true;
        }
        catch (e) {
            console.log(`  - ${p}: ERROR checking (${e})`);
        }
    }
    return false;
}
function startNgrok(port) {
    if (!shouldLaunchNgrok()) {
        console.log('[Ngrok] launch-ngrok.txt not found. Skipping ngrok launch.');
        return;
    }
    console.log(`[Ngrok] launch-ngrok.txt found! Starting ngrok tunnel on port ${port}...`);
    try {
        ngrokProcess = (0, child_process_1.spawn)('ngrok', ['http', String(port)], {
            shell: true,
            detached: false
        });
        ngrokProcess.on('error', (err) => {
            console.error('[Ngrok] Failed to start ngrok process:', err);
        });
    }
    catch (err) {
        console.error('[Ngrok] Exception spawning ngrok:', err);
    }
}
function killNgrok() {
    if (ngrokProcess) {
        console.log('[Ngrok] Terminating ngrok process...');
        try {
            if (process.platform === 'win32') {
                const { exec } = require('child_process');
                exec(`taskkill /pid ${ngrokProcess.pid} /T /F`, () => { });
            }
            else {
                ngrokProcess.kill();
            }
        }
        catch (e) {
            // Ignore
        }
        ngrokProcess = null;
    }
}
process.on('exit', killNgrok);
process.on('SIGINT', () => { killNgrok(); process.exit(); });
process.on('SIGTERM', () => { killNgrok(); process.exit(); });
function startServer(port) {
    server.listen(port, '0.0.0.0', () => {
        const ap = server.address()?.port || port;
        console.log(`Server listening on port ${ap}`);
        notifyPort(ap);
    }).on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.log(`Port ${port} is in use, trying ${port + 1}...`);
            startServer(port + 1);
        }
        else {
            console.error('Server error:', e);
        }
    });
}
app.get('/api/debug-dist', (req, res) => {
    res.json({
        clientDistPath: clientDistPath,
        dirname: __dirname,
        cwd: process.cwd(),
        execPath: process.execPath,
        exists: clientDistPath ? fs_1.default.existsSync(path_1.default.join(clientDistPath, 'index.html')) : false
    });
});
// Fallback for single page app routing
app.get('*', (req, res, next) => {
    if (clientDistPath && req.method === 'GET' && fs_1.default.existsSync(path_1.default.join(clientDistPath, 'index.html')) && !req.path.startsWith('/api/')) {
        res.sendFile(path_1.default.join(clientDistPath, 'index.html'));
    }
    else {
        next();
    }
});
startServer(PORT);
//# sourceMappingURL=index.js.map