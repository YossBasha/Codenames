import { Server } from "socket.io";
import { GameMode } from "../../../shared/types";
export declare function getLocalRoomsForRegistration(): {
    roomID: string;
    players: number;
    hostName: string;
    gameStarted: boolean;
    gameMode: GameMode;
}[];
export declare function registerRooms(serverUrl: string, roomsList: any[]): void;
export declare function getPublicRooms(): any[];
export declare function setupRoomManager(io: Server): void;
//# sourceMappingURL=roomManager.d.ts.map