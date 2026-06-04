package com.codenames.app;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.List;
import java.util.Enumeration;

@CapacitorPlugin(name = "Multicast")
public class MulticastPlugin extends Plugin {

    private WifiManager.MulticastLock multicastLock;

    @Override
    public void load() {
        super.load();
        try {
            WifiManager wifi = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifi != null) {
                multicastLock = wifi.createMulticastLock("CodenamesMulticastLock");
                multicastLock.setReferenceCounted(true);
                multicastLock.acquire();
                Log.d("CODENAMES_NETWORK", "Multicast Lock successfully acquired!");
            } else {
                Log.e("CODENAMES_NETWORK", "WifiManager was null. Failed to acquire lock.");
            }
        } catch (Exception e) {
            Log.e("CODENAMES_NETWORK", "CRITICAL ERROR acquiring Multicast Lock: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void acquire(PluginCall call) {
        if (multicastLock != null && !multicastLock.isHeld()) {
            multicastLock.acquire();
        }
        call.resolve();
    }

    @PluginMethod
    public void release(PluginCall call) {
        if (multicastLock != null && multicastLock.isHeld()) {
            multicastLock.release();
        }
        call.resolve();
    }

    /**
     * Send a UDP broadcast packet via native Java networking.
     * This bypasses the Node.js sandboxed runtime which Android often blocks from sending UDP broadcasts.
     * 
     * Expects: { payload: string, port: number }
     */
    @PluginMethod
    public void sendNativeBroadcast(PluginCall call) {
        String payload = call.getString("payload");
        Integer port = call.getInt("port");

        if (payload == null || port == null) {
            call.reject("Missing payload or port parameters.");
            return;
        }

        final String finalPayload = payload;
        final int finalPort = port;

        new Thread(() -> {
            DatagramSocket socket = null;
            try {
                socket = new DatagramSocket();
                socket.setBroadcast(true);

                byte[] buffer = finalPayload.getBytes("UTF-8");

                // 1. Universal broadcast (255.255.255.255)
                try {
                    InetAddress broadcastAddress = InetAddress.getByName("255.255.255.255");
                    DatagramPacket packet = new DatagramPacket(buffer, buffer.length, broadcastAddress, finalPort);
                    socket.send(packet);
                    Log.d("CODENAMES_NETWORK", "Native UDP broadcast sent to 255.255.255.255:" + finalPort);
                } catch (Exception e) {
                    Log.w("CODENAMES_NETWORK", "255.255.255.255 broadcast failed: " + e.getMessage());
                }

                // 2. Multicast (239.255.255.250 — same group as Node.js discovery)
                try {
                    InetAddress multicastAddress = InetAddress.getByName("239.255.255.250");
                    DatagramPacket packet = new DatagramPacket(buffer, buffer.length, multicastAddress, finalPort);
                    socket.send(packet);
                    Log.d("CODENAMES_NETWORK", "Native UDP multicast sent to 239.255.255.250:" + finalPort);
                } catch (Exception e) {
                    Log.w("CODENAMES_NETWORK", "Multicast send failed: " + e.getMessage());
                }

                // 3. Subnet-directed broadcasts on all active interfaces
                try {
                    Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
                    if (interfaces != null) {
                        List<NetworkInterface> interfaceList = Collections.list(interfaces);
                        for (NetworkInterface networkInterface : interfaceList) {
                            if (!networkInterface.isUp() || networkInterface.isLoopback()) continue;
                            List<InetAddress> broadcastAddresses = Collections.list(networkInterface.getInetAddresses());
                            for (InetAddress addr : broadcastAddresses) {
                                if (addr instanceof Inet4Address) {
                                    // Calculate subnet broadcast (assume /24)
                                    byte[] ip = addr.getAddress();
                                    ip[3] = (byte) 255;
                                    InetAddress subnetBroadcast = InetAddress.getByAddress(ip);
                                    try {
                                        DatagramPacket packet = new DatagramPacket(buffer, buffer.length, subnetBroadcast, finalPort);
                                        socket.send(packet);
                                        Log.d("CODENAMES_NETWORK", "Subnet broadcast sent to " + subnetBroadcast.getHostAddress() + ":" + finalPort + " via " + networkInterface.getDisplayName());
                                    } catch (Exception ex) {
                                        Log.w("CODENAMES_NETWORK", "Subnet broadcast on " + networkInterface.getDisplayName() + " failed: " + ex.getMessage());
                                    }
                                    
                                    // DEBUG: Unicast directly to laptop IP to bypass router broadcast suppression
                                    try {
                                        InetAddress laptopIp = InetAddress.getByName("192.168.8.170");
                                        DatagramPacket unicastPacket = new DatagramPacket(buffer, buffer.length, laptopIp, finalPort);
                                        socket.send(unicastPacket);
                                        Log.d("CODENAMES_NETWORK", "DEBUG Unicast sent to " + laptopIp.getHostAddress() + ":" + finalPort);
                                    } catch (Exception ex) {
                                        Log.w("CODENAMES_NETWORK", "DEBUG Unicast failed: " + ex.getMessage());
                                    }
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    Log.w("CODENAMES_NETWORK", "Interface enumeration failed: " + e.getMessage());
                }

            } catch (Exception e) {
                Log.e("CODENAMES_NETWORK", "Native UDP Broadcast failed: " + e.getMessage());
            } finally {
                if (socket != null && !socket.isClosed()) {
                    socket.close();
                }
            }
        }).start();

        call.resolve();
    }

    /**
     * Returns the device's real Wi-Fi or hotspot IP address.
     * Queries the native Android network stack, which is far more reliable than
     * Node.js os.networkInterfaces() inside the sandboxed runtime.
     */
    @PluginMethod
    public void getDeviceIP(PluginCall call) {
        try {
            String ip = null;
            String fallbackIp = null;

            // Strategy 1: Check all network interfaces for non-loopback IPv4
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            if (interfaces != null) {
                List<NetworkInterface> interfaceList = Collections.list(interfaces);
                for (NetworkInterface networkInterface : interfaceList) {
                    if (!networkInterface.isUp() || networkInterface.isLoopback()) continue;
                    String name = networkInterface.getDisplayName().toLowerCase();

                    List<InetAddress> addresses = Collections.list(networkInterface.getInetAddresses());
                    for (InetAddress addr : addresses) {
                        if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
                            String addrStr = addr.getHostAddress();
                            Log.d("CODENAMES_NETWORK", "Found IPv4: " + addrStr + " on " + name);

                            // Hotspot interfaces typically have gateway-like IPs (.1)
                            if (name.contains("ap") || name.contains("swlan") || name.contains("softap") || name.contains("rndis")) {
                                ip = addrStr;
                                break;
                            }
                            // Wi-Fi interfaces
                            if (name.contains("wlan")) {
                                if (ip == null) ip = addrStr;
                            }
                            // Any other non-loopback
                            if (fallbackIp == null) fallbackIp = addrStr;
                        }
                    }
                    if (ip != null) break;
                }
            }

            // Strategy 2: WifiManager (works when connected to Wi-Fi, not as hotspot host)
            if (ip == null) {
                WifiManager wifi = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wifi != null) {
                    @SuppressWarnings("deprecation")
                    int wifiIp = wifi.getConnectionInfo().getIpAddress();
                    if (wifiIp != 0) {
                        ip = String.format("%d.%d.%d.%d",
                            (wifiIp & 0xff), (wifiIp >> 8 & 0xff),
                            (wifiIp >> 16 & 0xff), (wifiIp >> 24 & 0xff));
                        Log.d("CODENAMES_NETWORK", "WifiManager IP: " + ip);
                    }
                }
            }

            String result = ip != null ? ip : (fallbackIp != null ? fallbackIp : "127.0.0.1");
            Log.d("CODENAMES_NETWORK", "getDeviceIP returning: " + result);

            JSObject ret = new JSObject();
            ret.put("ip", result);
            call.resolve(ret);

        } catch (Exception e) {
            Log.e("CODENAMES_NETWORK", "getDeviceIP failed: " + e.getMessage());
            JSObject ret = new JSObject();
            ret.put("ip", "127.0.0.1");
            call.resolve(ret);
        }
    }
}
