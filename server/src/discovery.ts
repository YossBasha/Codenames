import dgram from 'dgram';
import os from 'os';

const DISCOVERY_PORT = 41234;
const BROADCAST_IP = '255.255.255.255';
const MULTICAST_IP = '239.255.255.250';
const PROTOCOL_ID = 'CODENAMES_LAN';

let broadcastInterval: NodeJS.Timeout | null = null;
let broadcasterSockets: dgram.Socket[] = [];
let currentHostingInfo: { protocol: string; roomID: string; hostName: string; hostIP: string; port: number } | null = null;

let listenerSockets: dgram.Socket[] = [];

export interface DiscoveredRoom {
  protocol: string;
  roomID: string;
  hostName: string;
  hostIP: string;
  port: number;
  lastSeen: number;
}

let discoveredRooms: Map<string, DiscoveredRoom> = new Map();

interface InterfaceInfo {
  address: string;
  subnetBroadcast: string;
  name: string;
}

/** Collect all non-internal IPv4 interfaces with their subnet broadcast addresses */
function getAllIPv4Interfaces(): InterfaceInfo[] {
  const interfaces = os.networkInterfaces();
  const results: InterfaceInfo[] = [];
  for (const name in interfaces) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        const parts = alias.address.split('.');
        const subnetBroadcast = parts.length === 4
          ? `${parts[0]}.${parts[1]}.${parts[2]}.255`
          : null;
        if (subnetBroadcast) {
          results.push({ address: alias.address, subnetBroadcast, name });
        }
      }
    }
  }
  return results;
}

export function getLocalIPAddress(): string {
  const interfaces = os.networkInterfaces();
  let backupIp = '127.0.0.1';

  // Hotspot interface patterns on Android
  const hotspotPatterns = ['ap', 'wlan1', 'wlan2', 'softap', 'rndis'];

  // First Pass: Look specifically for active Hotspot interfaces standard on mobile
  for (const interfaceName in interfaces) {
    const lowerName = interfaceName.toLowerCase();
    if (hotspotPatterns.some(p => lowerName.includes(p))) {
      const iface = interfaces[interfaceName];
      if (!iface) continue;
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          // If it ends in .1, it's almost certainly the hotspot gateway IP
          if (alias.address.endsWith('.1')) return alias.address;
          backupIp = alias.address;
        }
      }
    }
  }

  // Second Pass: Look for active wlan (Wi-Fi) interfaces
  for (const interfaceName in interfaces) {
    if (interfaceName.toLowerCase().includes('wlan')) {
      const iface = interfaces[interfaceName];
      if (!iface) continue;
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          if (alias.address.endsWith('.1')) return alias.address;
          return alias.address;
        }
      }
    }
  }

  // Third Pass: Standard fallback logic for desktop/ethernet interfaces
  for (const interfaceName in interfaces) {
    const iface = interfaces[interfaceName];
    if (!iface) continue;
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        if (!interfaceName.toLowerCase().includes('virtual') && !interfaceName.toLowerCase().includes('vbox')) {
          backupIp = alias.address;
        }
      }
    }
  }
  return backupIp;
}

export function startBroadcasting(roomID: string, hostName: string, port: number, overrideHostIP?: string) {
  stopBroadcasting();

  // Use the override IP if provided (from native Android layer), otherwise detect locally
  const hostIP = (overrideHostIP && overrideHostIP !== '127.0.0.1' && overrideHostIP !== '0.0.0.0')
    ? overrideHostIP
    : getLocalIPAddress();
  const hostInfo = {
    protocol: PROTOCOL_ID,
    roomID,
    hostName,
    hostIP,
    port
  };
  currentHostingInfo = hostInfo;
  const payload = JSON.stringify(hostInfo);

  const allInterfaces = getAllIPv4Interfaces();
  console.log(`[Discovery] Detected interfaces: ${allInterfaces.map(i => `${i.name}=${i.address}`).join(', ')}`);
  console.log(`[Discovery] Starting UDP broadcast for room ${roomID} at ${hostIP}:${port}${overrideHostIP ? ' (native override)' : ''}`);

  // Create a broadcaster socket for each network interface.
  // Android often needs interface-specific sockets for broadcasts to actually leave the device.
  for (const iface of allInterfaces) {
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    sock.on('error', (err) => {
      console.warn(`[Discovery] Broadcaster error on ${iface.name} (${iface.address}): ${err.message}`);
    });

    sock.bind({ address: iface.address, exclusive: false }, () => {
      try { sock.setBroadcast(true); } catch (e: any) {
        console.warn(`[Discovery] setBroadcast failed on ${iface.name}: ${e.message}`);
      }
      try { sock.setMulticastTTL(128); } catch (e: any) {
        console.warn(`[Discovery] setMulticastTTL failed on ${iface.name}: ${e.message}`);
      }
      try { sock.addMembership(MULTICAST_IP, iface.address); } catch (e: any) {
        console.warn(`[Discovery] addMembership failed on ${iface.name}: ${e.message}`);
      }
    });

    broadcasterSockets.push(sock);
  }

  // Also create a fallback socket on 0.0.0.0 for the universal broadcast
  const fallbackSock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  fallbackSock.on('error', (err) => {
    console.warn(`[Discovery] Fallback broadcaster error: ${err.message}`);
  });
  fallbackSock.bind({ address: '0.0.0.0', exclusive: false }, () => {
    try { fallbackSock.setBroadcast(true); } catch (_) {}
    try { fallbackSock.setMulticastTTL(128); } catch (_) {}
  });
  broadcasterSockets.push(fallbackSock);

  broadcastInterval = setInterval(() => {
    const message = Buffer.from(payload);

    for (const sock of broadcasterSockets) {
      try {
        // Universal broadcast
        sock.send(message, 0, message.length, DISCOVERY_PORT, BROADCAST_IP);
      } catch (_) {}

      try {
        // Multicast
        sock.send(message, 0, message.length, DISCOVERY_PORT, MULTICAST_IP);
      } catch (_) {}
    }

    // Subnet directed broadcasts via interface-specific sockets
    for (let i = 0; i < allInterfaces.length && i < broadcasterSockets.length; i++) {
      const iface = allInterfaces[i];
      const sock = broadcasterSockets[i];
      if (iface.subnetBroadcast && iface.subnetBroadcast !== '0.0.0.255') {
        try {
          sock.send(message, 0, message.length, DISCOVERY_PORT, iface.subnetBroadcast);
        } catch (_) {}
      }
    }
  }, 2000);
}

export function stopBroadcasting() {
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
    broadcastInterval = null;
  }
  for (const sock of broadcasterSockets) {
    try { sock.close(); } catch (_) {}
  }
  broadcasterSockets = [];
  currentHostingInfo = null;
}

/** Returns the room info this server is currently hosting (for HTTP-based discovery) */
export function getHostingInfo() {
  return currentHostingInfo;
}

export function startListening() {
  if (listenerSockets.length > 0) return;

  discoveredRooms.clear();

  const handleMessage = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.protocol === PROTOCOL_ID) {
        console.log(`[Discovery] Received valid broadcast from ${rinfo.address}:${rinfo.port} payload: ${JSON.stringify(data)}`);
        const roomID = data.roomID;
        // If hostIP is loopback or missing, use the packet source address instead
        if (!data.hostIP || data.hostIP === '127.0.0.1' || data.hostIP === '0.0.0.0') {
          data.hostIP = rinfo.address;
        }
        discoveredRooms.set(roomID, {
          ...data,
          lastSeen: Date.now()
        });
      } else {
        console.log(`[Discovery] Received unknown payload protocol from ${rinfo.address}:${rinfo.port} payload: ${JSON.stringify(data)}`);
      }
    } catch (e: any) {
      // Ignore invalid packets
      console.log(`[Discovery] Failed to parse broadcast from ${rinfo.address}:${rinfo.port}. Error: ${e.message}. Raw: ${msg.toString()}`);
    }
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
        } catch (e: any) {
          // Ignore multicast join errors if multiple sockets try to join the same group on the same interface
        }
      }
      try { socket.addMembership(MULTICAST_IP); } catch (_) {}
      
      const address = socket.address();
      console.log(`[Discovery] Listening on ${address?.address}:${address?.port}`);
    });

    socket.on('error', (err) => {
      console.error(`[Discovery] UDP Listener Error on ${bindAddress}: ${err.message}`);
    });

    socket.bind({ port: DISCOVERY_PORT, address: bindAddress, exclusive: false });
    listenerSockets.push(socket);
  };

  // Bind to 0.0.0.0 (catches 255.255.255.255 universal broadcasts and acts as fallback)
  createListener('0.0.0.0');

  // Bind explicitly to every IPv4 interface. 
  // CRITICAL FIX: On Windows, sockets bound to 0.0.0.0 will SILENTLY DROP incoming subnet broadcasts 
  // (e.g. 192.168.8.255). We MUST bind explicitly to the interface IP to receive subnet broadcasts.
  const allInterfaces = getAllIPv4Interfaces();
  for (const iface of allInterfaces) {
    createListener(iface.address);
  }

  // --- TCP SUBNET SCAN FALLBACK ---
  // Since Windows Firewall without Admin rights blocks all incoming UDP discovery packets,
  // we actively scan the local /24 subnet over HTTP (TCP) to bypass firewall/router restrictions.
  const scanSubnets = () => {
    const interfaces = getAllIPv4Interfaces();
    for (const iface of interfaces) {
      if (iface.address.startsWith('127.')) continue;
      
      const ipParts = iface.address.split('.');
      if (ipParts.length !== 4) continue;
      
      const baseIp = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.`;
      // Use a custom agent to limit simultaneous connections to avoid Windows SYN flood detection
      const http = require('http');
      const agent = new http.Agent({ maxSockets: 20 });
      
      // Ping every IP in the /24 subnet
      for (let i = 1; i <= 254; i++) {
        const targetIp = baseIp + i;
        if (targetIp === iface.address) continue; // Skip self

        const req = http.get(`http://${targetIp}:3000/api/discovery/hosting`, { agent, timeout: 1500 }, (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.hosting && parsed.protocol === PROTOCOL_ID) {
                // Found a room via TCP!
                discoveredRooms.set(parsed.roomID, {
                  protocol: parsed.protocol,
                  roomID: parsed.roomID,
                  hostName: parsed.hostName,
                  hostIP: targetIp, // Use the IP we successfully reached
                  port: parsed.port,
                  lastSeen: Date.now()
                });
              }
            } catch (_) {}
          });
        });
        
        req.on('error', () => {});
        req.on('timeout', () => req.destroy());
      }
    }
  };

  // Run a scan immediately and then every 4 seconds
  scanSubnets();
  scanInterval = setInterval(scanSubnets, 4000);
}

let scanInterval: NodeJS.Timeout | null = null;

export function stopListening() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  for (const socket of listenerSockets) {
    try { socket.close(); } catch (_) {}
  }
  listenerSockets = [];
}

export function getDiscoveredRooms() {
  const now = Date.now();
  const activeRooms: DiscoveredRoom[] = [];
  
  // Prune rooms not seen in the last 6 seconds
  for (const [id, room] of discoveredRooms.entries()) {
    if (now - room.lastSeen > 6000) {
      discoveredRooms.delete(id);
    } else {
      activeRooms.push(room);
    }
  }
  
  return activeRooms;
}

