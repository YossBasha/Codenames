import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Language, Player } from '../../../shared/types';
import { Socket } from 'socket.io-client';

interface GameContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  player: Player | null;
  setPlayer: (player: Player | null) => void;
  roomId: string | null;
  setRoomId: (id: string | null) => void;
  socket: Socket | null;
  setSocket: (socket: Socket | null) => void;
}

const GameContext = createContext<GameContextProps | undefined>(undefined);

// Generate or retrieve a persistent session ID
function getSessionId() {
  let id = localStorage.getItem('codenames_session_id');
  if (!id) {
    id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('codenames_session_id', id);
  }
  return id;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  const [player, setPlayer] = useState<Player | null>(() => {
    return {
      id: '',
      sessionId: getSessionId(),
      name: localStorage.getItem('codenames_nickname') || '',
      team: 'spectator',
      role: 'spectator'
    };
  });
  const [roomId, setRoomId] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  return (
    <GameContext.Provider
      value={{
        language,
        setLanguage,
        player,
        setPlayer,
        roomId,
        setRoomId,
        socket,
        setSocket,
      }}
    >
      <div className="min-h-screen">
        {children}
      </div>
    </GameContext.Provider>
  );
}

export function useGameContext() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
}
