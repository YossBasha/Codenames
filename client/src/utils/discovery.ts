import { Capacitor } from '@capacitor/core';
import Multicast from './multicast-plugin';

export interface DiscoveredRoom {
  protocol: string;
  roomID: string;
  hostName: string;
  hostIP: string;
  port: number;
  lastSeen: number;
}

export async function getLocalServerPort(): Promise<number> {
  // If running in Electron
  if ((window as any).electronAPI) {
    return await (window as any).electronAPI.getServerPort();
  }
  
  // If running in Capacitor (nodejs-mobile), we might inject it via window
  if (Capacitor.isNativePlatform()) {
    if ((window as any).SERVER_PORT) {
      return (window as any).SERVER_PORT;
    }
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if ((window as any).SERVER_PORT) {
          clearInterval(interval);
          resolve((window as any).SERVER_PORT);
        }
      }, 100);
    });
  }
  
  // Default for normal browser dev environment
  return 3000; 
}

export async function getBaseApiUrl(): Promise<string> {
  const port = await getLocalServerPort();
  
  // Try to use the native IP to avoid Android WebView 127.0.0.1 cleartext/CORS blocks
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Multicast.getDeviceIP();
      if (result.ip && result.ip !== '127.0.0.1') {
        return `http://${result.ip}:${port}/api/discovery`;
      }
    } catch (_) {}
  }
  
  // If testing on a mobile browser on the local network
  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `http://${window.location.hostname}:${port}/api/discovery`;
  }

  return `http://localhost:${port}/api/discovery`;
}

export async function getLocalIp(): Promise<string> {
  // On mobile, query the native Android layer for the real device IP
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Multicast.getDeviceIP();
      if (result.ip && result.ip !== '127.0.0.1') {
        console.log('[Discovery] Native device IP:', result.ip);
        return result.ip;
      }
    } catch (e) {
      console.warn('[Discovery] Native getDeviceIP failed, falling back to server:', e);
    }
  }

  // Fallback: ask the Node.js server (works on desktop, may be wrong on Android)
  try {
    const port = await getLocalServerPort();
    const res = await fetch(`http://127.0.0.1:${port}/api/local-ip`);
    const data = await res.json();
    return data.ip || '127.0.0.1';
  } catch (e) {
    return '127.0.0.1';
  }
}

// ─── Native broadcast interval handle ───
let nativeBroadcastInterval: ReturnType<typeof setInterval> | null = null;

export async function startHostBroadcast(roomID: string, hostName: string) {
  const port = await getLocalServerPort();
  const url = await getBaseApiUrl();

  // On mobile: resolve the real device IP via native Android APIs first,
  // then pass it to BOTH the Node.js server and the native broadcaster
  // so both pipelines agree on the same hostIP.
  let nativeIP: string | null = null;
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Multicast.getDeviceIP();
      if (result.ip && result.ip !== '127.0.0.1' && result.ip !== '0.0.0.0') {
        nativeIP = result.ip;
        console.log('[Discovery] Native device IP resolved:', nativeIP);
      }
    } catch (e) {
      console.warn('[Discovery] Native getDeviceIP failed:', e);
    }
  }

  // Tell the Node.js server to start its UDP broadcaster.
  // On mobile, pass the native IP so the server uses it instead of os.networkInterfaces().
  try {
    const body: Record<string, any> = { roomID, hostName, port };
    if (nativeIP) body.hostIP = nativeIP;
    await fetch(`${url}/start-host`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.error('Failed to start Node.js broadcast', e);
  }

  // On mobile: also start a native Java UDP broadcaster as a supplementary pipeline.
  // The Node.js dgram module is sandboxed by Android and its packets get silently dropped.
  if (Capacitor.isNativePlatform()) {
    stopNativeBroadcast();

    const hostIP = nativeIP || '127.0.0.1';
    const payload = JSON.stringify({
      protocol: 'CODENAMES_LAN',
      roomID,
      hostName,
      hostIP,
      port
    });

    const DISCOVERY_PORT = 41234;

    const sendBroadcast = () => {
      Multicast.sendNativeBroadcast({ payload, port: DISCOVERY_PORT }).catch((e) => {
        console.warn('[NativeBroadcast] send failed:', e);
      });
    };

    sendBroadcast();
    nativeBroadcastInterval = setInterval(sendBroadcast, 2000);
    console.log('[Discovery] Native Java UDP broadcaster started for room', roomID, 'hostIP:', hostIP);
  }
}

function stopNativeBroadcast() {
  if (nativeBroadcastInterval) {
    clearInterval(nativeBroadcastInterval);
    nativeBroadcastInterval = null;
  }
}

export async function stopHostBroadcast() {
  // Stop native broadcaster
  stopNativeBroadcast();

  // Stop Node.js broadcaster
  const url = await getBaseApiUrl();
  try {
    await fetch(`${url}/stop-host`, { method: 'POST' });
  } catch (e) {
    console.error('Failed to stop broadcast', e);
  }
}

export async function startListening() {
  const url = await getBaseApiUrl();
  try {
    await fetch(`${url}/start-listen`, { method: 'POST' });
  } catch (e) {
    console.error('Failed to start listening', e);
  }
}

export async function stopListening() {
  const url = await getBaseApiUrl();
  try {
    await fetch(`${url}/stop-listen`, { method: 'POST' });
  } catch (e) {
    console.error('Failed to stop listening', e);
  }
}

export async function getDiscoveredRooms(): Promise<DiscoveredRoom[]> {
  const url = await getBaseApiUrl();
  try {
    const res = await fetch(`${url}/rooms`);
    const data = await res.json();
    return data.rooms || [];
  } catch (e) {
    console.error('Failed to get discovered rooms', e);
    return [];
  }
}

/**
 * HTTP-based discovery fallback for when UDP broadcasts don't work (e.g. Android hosts).
 * Probes common hotspot gateway IPs and the local subnet gateway to find a Codenames server.
 */
export async function scanForRoomsHTTP(): Promise<DiscoveredRoom[]> {
  // Common Android hotspot gateway IPs
  const candidateIPs = [
    '192.168.43.1',   // Android default hotspot
    '192.168.49.1',   // Android Wi-Fi Direct / newer hotspots
    '192.168.1.1',    // Common router
    '192.168.0.1',    // Common router
    '10.0.0.1',       // Some carriers
    '172.20.10.1',    // iPhone hotspot
  ];

  try {
    const localIp = await getLocalIp();
    if (localIp && localIp !== '127.0.0.1') {
      const parts = localIp.split('.');
      if (parts.length === 4) {
        const gateway = `${parts[0]}.${parts[1]}.${parts[2]}.1`;
        if (!candidateIPs.includes(gateway)) {
          candidateIPs.unshift(gateway); // highest priority
        }
      }
    }
  } catch (_) {}

  // Also ALWAYS check the IP we are currently hosted from (crucial for mobile browser testing)
  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    if (!candidateIPs.includes(window.location.hostname)) {
      candidateIPs.unshift(window.location.hostname);
    }
  }

  const ports = [3000, 3001, 3002, 3003, 3004, 3005];
  const rooms: DiscoveredRoom[] = [];

  // Probe all candidates in parallel with short timeouts
  const probes: Promise<void>[] = [];
  for (const ip of candidateIPs) {
    for (const port of ports) {
      probes.push(
        (async () => {
          try {
            const res = await fetch(`http://${ip}:${port}/api/discovery/hosting`, {
              signal: AbortSignal.timeout(800),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.hosting && data.roomID) {
                // Use the IP we successfully reached, not what the server thinks its IP is
                rooms.push({
                  protocol: data.protocol || 'CODENAMES_LAN',
                  roomID: data.roomID,
                  hostName: data.hostName || 'Unknown',
                  hostIP: ip,
                  port: data.port || port,
                  lastSeen: Date.now(),
                });
              }
            }
          } catch (_) {
            // Timeout or unreachable — expected for most probes
          }
        })()
      );
    }
  }

  await Promise.allSettled(probes);
  return rooms;
}
