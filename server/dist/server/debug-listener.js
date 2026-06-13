"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dgram_1 = __importDefault(require("dgram"));
const os_1 = __importDefault(require("os"));
const DISCOVERY_PORT = 41234;
const MULTICAST_IP = '239.255.255.250';
function getAllIPv4Interfaces() {
    const interfaces = os_1.default.networkInterfaces();
    const ipv4Interfaces = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ipv4Interfaces.push({ name, address: iface.address });
            }
        }
    }
    return ipv4Interfaces;
}
const listenerSockets = [];
const handleMessage = (msg, rinfo) => {
    console.log(`\n===========================================`);
    console.log(`[DEBUG] Received UDP packet from ${rinfo.address}:${rinfo.port}`);
    console.log(`[DEBUG] Raw Payload: ${msg.toString()}`);
    console.log(`===========================================\n`);
};
const createListener = (bindAddress) => {
    const socket = dgram_1.default.createSocket({ type: 'udp4', reuseAddr: true });
    socket.on('message', handleMessage);
    socket.on('listening', () => {
        try {
            socket.setBroadcast(true);
        }
        catch (_) { }
        const allInterfaces = getAllIPv4Interfaces();
        for (const iface of allInterfaces) {
            try {
                socket.addMembership(MULTICAST_IP, iface.address);
            }
            catch (e) { }
        }
        try {
            socket.addMembership(MULTICAST_IP);
        }
        catch (_) { }
        const address = socket.address();
        console.log(`[Discovery] Bound to interface ${bindAddress} - Listening on ${address?.address}:${address?.port}`);
    });
    socket.on('error', (err) => {
        console.error(`[Discovery] Listener Error on ${bindAddress}: ${err.message}`);
    });
    socket.bind({ port: DISCOVERY_PORT, address: bindAddress, exclusive: false });
    listenerSockets.push(socket);
};
console.log("Starting debug listener...");
createListener('0.0.0.0');
const allInterfaces = getAllIPv4Interfaces();
for (const iface of allInterfaces) {
    createListener(iface.address);
}
//# sourceMappingURL=debug-listener.js.map