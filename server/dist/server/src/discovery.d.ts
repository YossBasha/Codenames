export interface DiscoveredRoom {
    protocol: string;
    roomID: string;
    hostName: string;
    hostIP: string;
    port: number;
    lastSeen: number;
}
export declare function getLocalIPAddress(): string;
export declare function startBroadcasting(roomID: string, hostName: string, port: number, overrideHostIP?: string): void;
export declare function stopBroadcasting(): void;
/** Returns the room info this server is currently hosting (for HTTP-based discovery) */
export declare function getHostingInfo(): {
    protocol: string;
    roomID: string;
    hostName: string;
    hostIP: string;
    port: number;
} | null;
export declare function startListening(): void;
export declare function stopListening(): void;
export declare function getDiscoveredRooms(): DiscoveredRoom[];
//# sourceMappingURL=discovery.d.ts.map