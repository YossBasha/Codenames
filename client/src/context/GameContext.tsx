import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { Language, Player, ThemeType } from '../../../shared/types';
import { Socket } from 'socket.io-client';
import { setMasterVolume } from '../utils/sfx';

import { SPECIAL_AVATAR } from '../assets/specialAvatar';
import { SPECIAL_AVATAR_GAV } from '../assets/specialAvatarGav';

interface GameContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  player: Player | null;
  setPlayer: React.Dispatch<React.SetStateAction<Player | null>>;
  roomId: string | null;
  setRoomId: (id: string | null) => void;
  socket: Socket | null;
  setSocket: (socket: Socket | null) => void;
  volume: number;
  setVolume: (vol: number) => void;
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
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
      avatarBase64: (() => {
        let saved = localStorage.getItem('codenames_avatar');
        if (!saved) return '';
        
        // Seamlessly upgrade broken Vite absolute paths back to base64
        if (saved.toLowerCase().includes('yoss') && saved.startsWith('file://')) {
          saved = SPECIAL_AVATAR;
          localStorage.setItem('codenames_avatar', saved);
          return saved;
        }
        if (saved.toLowerCase().includes('gav') && saved.startsWith('file://')) {
          saved = SPECIAL_AVATAR_GAV;
          localStorage.setItem('codenames_avatar', saved);
          return saved;
        }
        
        // Clear any other broken local file paths
        if (saved.startsWith('file://') || saved.startsWith('http') || saved.startsWith('/assets/')) {
          localStorage.removeItem('codenames_avatar');
          return '';
        }
        
        return saved;
      })(),
      team: 'spectator',
      role: 'spectator'
    };
  });
  const [roomId, setRoomId] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('codenames_volume');
    return saved ? parseFloat(saved) : 0.5;
  });

  const [theme, setTheme] = useState<ThemeType>(() => {
    return (localStorage.getItem('codenames_theme') as ThemeType) || 'default';
  });

  React.useEffect(() => {
    localStorage.setItem('codenames_volume', volume.toString());
    setMasterVolume(volume);
  }, [volume]);

  React.useEffect(() => {
    localStorage.setItem('codenames_theme', theme);
    document.body.className = `theme-${theme}`;
  }, [theme]);

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
        volume,
        setVolume,
        theme,
        setTheme,
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
