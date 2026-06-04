import dgram from 'dgram';
import os from 'os';

const DISCOVERY_PORT = 41234;
const MULTICAST_IP = '239.255.255.250';

function getAllIPv4Interfaces() {
  const interfaces = os.networkInterfaces();
  const ipv4Interfaces: { name: string; address: string }[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ipv4Interfaces.push({ name, address: iface.address });
      }
    }
  }
  return ipv4Interfaces;
}

const listenerSockets: dgram.Socket[] = [];

const handleMessage = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
  console.log(`\n===========================================`);
  console.log(`[DEBUG] Received UDP packet from ${rinfo.address}:${rinfo.port}`);
  console.log(`[DEBUG] Raw Payload: ${msg.toString()}`);
  console.log(`===========================================\n`);
};

const createListener = (bindAddress: string) => {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  socket.on('message', handleMessage);
  
  socket.on('listening', () => {
    try { socket.setBroadcast(true); } catch (_) {}
    
    const allInterfaces = getAllIPv4Interfaces();
    for (const iface of allInterfaces) {
      try {
        socket.addMembership(MULTICAST_IP, iface.address);
      } catch (e: any) {}
    }
    try { socket.addMembership(MULTICAST_IP); } catch (_) {}
    
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
