import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useGameContext } from '../context/GameContext';
import type { Player, Team, Role, CustomWordWeight, TimerSettings, ClueType } from '../../../shared/types';
import { ArrowLeft } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import GameSettingsPanel from '../components/GameSettingsPanel';
import { twMerge } from 'tailwind-merge';
import { getLocalServerPort, startHostBroadcast, stopHostBroadcast, getLocalIp } from '../utils/discovery';
import { playLobbyHoverSfx, playLobbyClickSfx, playMenuClickSfx, playMenuHoverSfx } from '../utils/sfx';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function LANLobby() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isHost = searchParams.get('host') === 'true';
  const isWan = searchParams.get('wan') === 'true';

  const { player, setPlayer, roomId, setRoomId, socket, setSocket, language, setLanguage } = useGameContext();
  
  // connectIp is the stable address used for socket.io - never changes after mount.
  // Host always connects to own server via 127.0.0.1, UNLESS it's a browser test over LAN.
  const connectIp = useMemo(() => {
    if (isHost) {
      if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return window.location.hostname;
      }
      return '127.0.0.1';
    }
    return searchParams.get('ip') || '127.0.0.1';
  }, [isHost, searchParams]);
  const [serverIp, setServerIp] = useState(searchParams.get('ip') || (isHost ? 'Detecting IP...' : '127.0.0.1'));
  const [serverPort, setServerPort] = useState(parseInt(searchParams.get('port') || '0', 10));
  const [inputRoom, setInputRoom] = useState(searchParams.get('room') || `Room-${Math.floor(Math.random() * 10000)}`);
  const savedNickname = localStorage.getItem('codenames_nickname') || '';
  const [name, setName] = useState(player?.name || savedNickname);
  
  // Auto-fetch real LAN IP for display and broadcast (host only)
  useEffect(() => {
    if (isHost && !searchParams.get('ip')) {
      getLocalIp().then(ip => setServerIp(ip));
    }
  }, [isHost]);

  const [showWelcomeModal, setShowWelcomeModal] = useState(() => {
    return !player?.name && !savedNickname;
  });
  
  const [gameMode, setGameMode] = useState<'classic'|'duet'>(() => (localStorage.getItem('host_gameMode') as 'classic'|'duet') || 'classic');
  const [selectedPacks, setSelectedPacks] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('host_selectedPacks') || '["classic"]'); } catch { return ['classic']; }
  });
  const [clueType, setClueType] = useState<ClueType>(() => (localStorage.getItem('host_clueType') as ClueType) || 'text');
  
  const [timerSettings, setTimerSettings] = useState<TimerSettings>(() => {
    try { return JSON.parse(localStorage.getItem('host_timerSettings') || '{"preset":"off","spymasterTime":0,"operativeTime":0,"extraFirstClueTime":0}'); } 
    catch { return { preset: 'off', spymasterTime: 0, operativeTime: 0, extraFirstClueTime: 0 }; }
  });
  const [customWordsText, setCustomWordsText] = useState(() => localStorage.getItem('host_customWordsText') || '');
  const [customWordWeight, setCustomWordWeight] = useState<CustomWordWeight>(() => (localStorage.getItem('host_customWordWeight') as CustomWordWeight) || 'none');

  useEffect(() => {
    if (isHost) {
      localStorage.setItem('host_gameMode', gameMode);
      localStorage.setItem('host_selectedPacks', JSON.stringify(selectedPacks));
      localStorage.setItem('host_clueType', clueType);
      localStorage.setItem('host_customWordsText', customWordsText);
      localStorage.setItem('host_customWordWeight', customWordWeight);
      localStorage.setItem('host_timerSettings', JSON.stringify(timerSettings));
    }
  }, [isHost, gameMode, selectedPacks, clueType, customWordsText, customWordWeight, timerSettings]);

  const customWordsArray = useMemo(() => {
    if (!customWordsText.trim()) return [];
    const lines = customWordsText.split('\n');
    const cleaned = lines.map(line => line.trim().toUpperCase()).filter(line => line.length > 0);
    return Array.from(new Set(cleaned));
  }, [customWordsText]);
  
  const [roomPlayers, setRoomPlayers] = useState<Player[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [hostDisconnected, setHostDisconnected] = useState(false);
  
  const connectionRef = useRef({ serverIp, inputRoom, name });

  useEffect(() => {
    connectionRef.current = { serverIp, inputRoom, name };
  }, [serverIp, inputRoom, name]);

  useEffect(() => {
    if (isHost && !serverPort) {
      const checkPort = setInterval(async () => {
        const port = await getLocalServerPort();
        if (port && port > 0) {
          setServerPort(port);
          clearInterval(checkPort);
        }
      }, 500);
      return () => clearInterval(checkPort);
    }
  }, [isHost, serverPort]);

  useEffect(() => {
    if (isHost && serverPort > 0 && name.trim() && !name.startsWith('Spectator')) {
      startHostBroadcast(inputRoom, name);
    }
    // We intentionally DO NOT stopHostBroadcast on unmount so the room stays discoverable
    // when navigating to the game screen. We only stop it if they explicitly go back to the menu.
  }, [isHost, serverPort, inputRoom, name]);

  useEffect(() => {
    setIsConnected(false);
    const timeout = setTimeout(() => {
      // Use connectIp (stable, never changes) not serverIp (display only, can update)
      if (!isWan && (!connectIp || !inputRoom || serverPort === 0)) return;
      if (isWan && !inputRoom) return;

      if (socket) {
        socket.disconnect();
      }

      const socketUrl = isWan 
        ? (import.meta.env.VITE_WAN_SERVER_URL || 'http://localhost:3000')
        : `http://${connectIp}:${serverPort}`;

      const newSocket = io(socketUrl, {
        reconnectionDelayMax: 10000,
        timeout: 10000
      });
      
      newSocket.on('connect_error', (error) => {
        console.error('Socket connect error:', error);
        setConnectionError(`Connection Failed: ${error.message}`);
      });

      newSocket.on('connect', () => {
        setIsConnected(true);
        setConnectionError(null);
        setSocket(newSocket);
        setRoomId(inputRoom);
        
        if (player) {
          const currentPlayer = { 
            ...player, 
            id: newSocket.id!,
            name: name.trim() || `Spectator ${newSocket.id!.substring(0,4)}` 
          };
          setPlayer(currentPlayer);
          newSocket.emit('join_room', { roomId: inputRoom, player: currentPlayer });
        }
      });

      newSocket.on('disconnect', () => {
        setIsConnected(false);
        if (!isHost) {
          setHostDisconnected(true);
          setTimeout(() => navigate('/'), 4000);
        }
      });

      newSocket.on('room_update', (room) => {
        setRoomPlayers(room.players);
        setPlayer(prev => {
          if (!prev) return prev;
          const me = room.players.find((p: Player) => p.id === prev.id);
          if (me && (me.team !== prev.team || me.role !== prev.role)) {
            return { ...prev, team: me.team, role: me.role };
          }
          return prev;
        });
      });
      
      newSocket.on('game_started', () => {
        navigate('/lan-game');
      });

      if (!isHost) {
        newSocket.on('host_disconnected', () => {
          setHostDisconnected(true);
          setTimeout(() => navigate('/'), 4000);
        });
      }

    }, 1000); 

    return () => clearTimeout(timeout);
  // connectIp is stable (never changes), so only serverPort and inputRoom can trigger reconnect
  }, [connectIp, inputRoom, serverPort]);

  // Sync settings from host to clients
  useEffect(() => {
    if (isHost && socket && roomId) {
      socket.emit('update_settings', {
        roomId,
        settings: {
          gameMode,
          selectedPacks,
          timerSettings,
          customWordsText,
          customWordWeight,
          language,
          clueType
        }
      });
    }
  }, [gameMode, selectedPacks, timerSettings, customWordsText, customWordWeight, language, clueType, isHost, socket, roomId]);

  // Listen for settings from host
  useEffect(() => {
    if (!socket) return;
    
    socket.on('settings_updated', (settings) => {
      if (isHost) return; // Host is source of truth
      
      setGameMode(settings.gameMode);
      setSelectedPacks(settings.selectedPacks);
      setTimerSettings(settings.timerSettings);
      setCustomWordsText(settings.customWordsText);
      setCustomWordWeight(settings.customWordWeight);
      setLanguage(settings.language);
      setClueType(settings.clueType || 'both');
    });
    
    return () => {
      socket.off('settings_updated');
    };
  }, [socket, isHost, setLanguage]);

  const handleJoinTeam = (team: Team, role: Role) => {
    if (!socket || !roomId || !isConnected) { setTimeout(() => alert("Not connected to server yet."), 10); return; }
    if (!name.trim()) { setTimeout(() => alert("Please enter a Display Name."), 10); return; }

    const newPlayer: Player = {
      ...(player || {}),
      id: socket.id!,
      name,
      team,
      role
    };
    
    setPlayer(newPlayer);
    socket.emit('join_room', { roomId, player: newPlayer, explicitChange: true });
    playLobbyClickSfx();
  };

  const handleWelcomeSubmit = () => {
    if (!name.trim()) return;
    localStorage.setItem('codenames_nickname', name.trim());
    setShowWelcomeModal(false);
    if (player && socket) {
      const updatedPlayer = { ...player, name };
      setPlayer(updatedPlayer);
      socket.emit('join_room', { roomId: inputRoom, player: updatedPlayer });
    }
  };

  const handleStartGame = () => {
    if (!player || player.team === 'spectator') { setTimeout(() => alert("You must join a team before starting the game."), 10); return; }
    if (socket && roomId) {
      socket.emit('start_game', { 
        roomId, 
        language, 
        gameMode, 
        timerSettings,
        selectedPacks,
        customWords: customWordsArray,
        customWordWeight,
        clueType
      });
      playLobbyClickSfx();
    }
  };

  const handleResetTeams = () => {
    if (socket && roomId && isHost) {
      socket.emit('reset_teams', { roomId });
      playLobbyClickSfx();
    }
  };

  const handleRandomizeTeams = () => {
    if (socket && roomId && isHost) {
      socket.emit('randomize_teams', { roomId });
      playLobbyClickSfx();
    }
  };

  const blueOperatives = roomPlayers.filter(p => p.team === 'blue' && p.role === 'operative');
  const blueSpymasters = roomPlayers.filter(p => p.team === 'blue' && p.role === 'spymaster');
  const redOperatives = roomPlayers.filter(p => p.team === 'red' && p.role === 'operative');
  const redSpymasters = roomPlayers.filter(p => p.team === 'red' && p.role === 'spymaster');
  
  const redPlayers = roomPlayers.filter(p => p.team === 'red');
  const bluePlayers = roomPlayers.filter(p => p.team === 'blue');
  const spectators = roomPlayers.filter(p => p.team === 'spectator');

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col p-4 sm:p-6 font-sans text-white">
      {/* Host Disconnected Overlay */}
      {hostDisconnected && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1e1e1e] border-2 border-red-500/40 rounded-3xl p-8 max-w-md w-full shadow-[0_0_60px_rgba(239,68,68,0.2)] text-center flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-white tracking-wide">HOST DISCONNECTED</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              The host has left the room. You will be returned to the main menu shortly.
            </p>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-red-500 rounded-full animate-shrink-bar" />
            </div>
            <button
              onClick={() => navigate('/')}
              className="mt-1 px-8 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-2xl font-bold text-white transition-colors text-sm tracking-widest"
            >
              RETURN NOW
            </button>
          </div>
        </div>
      )}
      {/* Welcome Modal */}
      {showWelcomeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#333] border border-white/10 rounded-3xl p-6 lg:p-8 max-w-sm w-full shadow-2xl flex flex-col gap-4 text-center">
            <h2 className="text-xl font-bold text-white mb-2">Welcome to Codenames</h2>
            <p className="text-slate-300 text-sm mb-4">To enter the room, choose a nickname.</p>
            <input 
              type="text" 
              placeholder="Nickname"
              value={name.startsWith('Spectator') ? '' : name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white text-black rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#e67e22] font-bold"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim() && !name.startsWith('Spectator')) {
                  handleWelcomeSubmit();
                }
              }}
              autoFocus
            />
            <button 
              onMouseEnter={playMenuHoverSfx}
              onClick={() => { playMenuClickSfx(); handleWelcomeSubmit(); }}
              disabled={!name.trim() || name.startsWith('Spectator')}
              className="w-full py-3 bg-gradient-to-b from-[#f39c12] to-[#d35400] hover:from-[#e67e22] hover:to-[#c0392b] border-2 border-white/20 rounded-2xl font-black text-white shadow-lg transition-transform hover:scale-105 tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ENTER GAME
            </button>
          </div>
        </div>
      )}

      {/* Top Bar */}
      {connectionError && (
        <div className="bg-red-600/90 text-white font-bold p-3 text-center z-50 text-sm shadow-md rounded-xl mb-4 border border-red-400">
          {connectionError}
        </div>
      )}
      <div className="flex items-center mb-2">
        <button onMouseEnter={playMenuHoverSfx} onClick={() => {
          playMenuClickSfx();
          if (isHost) stopHostBroadcast();
          navigate('/');
        }} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Main Content Layout */}
      <div className={cn("flex-1 max-w-[1400px] w-full mx-auto grid gap-3", 
        gameMode === 'duet' ? "grid-cols-1 lg:grid-cols-[2fr_1fr]" : "grid-cols-1 lg:grid-cols-[1fr_2fr_1fr]"
      )}>
        
        {/* LEFT COLUMN: BLUE TEAM (Only in Classic) */}
        {gameMode === 'classic' && (
          <div className="flex flex-col gap-4">
            <div className="bg-slate-800 rounded-full py-2 text-center border-2 border-slate-600 font-bold tracking-widest text-sm shadow-md">
              BLUE TEAM
            </div>
            
            <div className="flex-1 bg-blue-500/20 border-2 border-blue-400 rounded-3xl p-4 flex flex-col items-center justify-between shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              <div className="w-full text-center">
                <h3 className="font-bold mb-2 tracking-widest">OPERATIVES</h3>
                <div className="flex flex-col gap-2 min-h-[50px]">
                  {blueOperatives.map(p => (
                    <div key={p.id} className="bg-blue-600/50 px-4 py-2 rounded-xl text-center font-bold">
                      {p.name} {p.id === player?.id && '(You)'}
                    </div>
                  ))}
                </div>
              </div>
              <button 
                onMouseEnter={playLobbyHoverSfx}
                onClick={() => handleJoinTeam('blue', 'operative')}
                disabled={!isConnected}
                className="mt-4 w-full py-2 bg-blue-500 hover:bg-blue-400 rounded-full font-bold text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              >
                {isConnected ? 'JOIN TEAM' : 'CONNECTING...'}
              </button>
            </div>

            <div className="flex-1 bg-blue-400/20 border-2 border-blue-300 rounded-3xl p-4 flex flex-col items-center justify-between shadow-[0_0_20px_rgba(96,165,250,0.3)]">
              <div className="w-full text-center">
                <h3 className="font-bold mb-2 tracking-widest">SPYMASTERS</h3>
                <div className="flex flex-col gap-2 min-h-[50px]">
                  {blueSpymasters.map(p => (
                    <div key={p.id} className="bg-blue-500/50 px-4 py-2 rounded-xl text-center font-bold">
                      {p.name} {p.id === player?.id && '(You)'}
                    </div>
                  ))}
                </div>
              </div>
              <button 
                onMouseEnter={playLobbyHoverSfx}
                onClick={() => handleJoinTeam('blue', 'spymaster')}
                disabled={!isConnected}
                className="mt-4 w-full py-2 bg-blue-500 hover:bg-blue-400 rounded-full font-bold text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              >
                {isConnected ? 'JOIN TEAM' : 'CONNECTING...'}
              </button>
            </div>
          </div>
        )}

        {/* MIDDLE COLUMN: SETTINGS & SPECTATORS */}
        <div className="bg-[#242424] rounded-3xl p-4 lg:p-6 flex flex-col gap-4 shadow-xl relative">
          
          {/* SPECTATORS POOL */}
          <div className="flex flex-col gap-2">
            <div className="text-center font-bold text-sm tracking-widest text-slate-400 border-b border-white/10 pb-2">
              SPECTATORS
            </div>
            <div className="flex flex-wrap justify-center gap-2 min-h-[40px]">
              {spectators.length === 0 ? (
                <span className="text-slate-500 text-xs italic my-auto">No spectators</span>
              ) : (
                spectators.map(p => (
                  <div key={p.id} className="bg-slate-700/50 text-slate-300 px-3 py-1 rounded-full text-sm font-bold border border-slate-600">
                    {p.name} {p.id === player?.id && '(You)'}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="text-center font-bold text-lg tracking-widest mt-2 border-b border-white/10 pb-2">
            {isWan ? "ONLINE MULTIPLAYER & SETTINGS" : "LAN MULTIPLAYER & GAME SETTINGS"}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1 ml-2">Display Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  if (name.trim()) {
                    localStorage.setItem('codenames_nickname', name.trim());
                  }
                  if (player && socket) {
                    const updatedPlayer = { ...player, name };
                    setPlayer(updatedPlayer);
                    socket.emit('join_room', { roomId: inputRoom, player: updatedPlayer });
                  }
                }}
                className="w-full bg-[#1a1a1a] border border-slate-700 rounded-2xl px-3 py-2 outline-none focus:border-slate-500 font-bold"
              />
            </div>
            {isWan ? (
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 ml-2">Invite Link</label>
                <input 
                  type="text" 
                  value={`${window.location.origin}/lan-lobby?wan=true&room=${encodeURIComponent(inputRoom)}`}
                  readOnly
                  className="w-full bg-[#1a1a1a] border border-slate-700 rounded-2xl px-3 py-2 outline-none font-mono font-bold text-xs opacity-70 cursor-default select-all text-blue-400 hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    const target = e.target as HTMLInputElement;
                    target.select();
                    navigator.clipboard.writeText(target.value);
                  }}
                  title="Click to copy invite link"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 ml-2">Host IP Address</label>
                <input 
                  type="text" 
                  value={serverIp}
                  readOnly
                  className="w-full bg-[#1a1a1a] border border-slate-700 rounded-2xl px-3 py-2 outline-none font-mono font-bold text-sm opacity-70 cursor-default select-all"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1 ml-2">Room ID</label>
              <input 
                type="text" 
                value={inputRoom}
                onChange={(e) => setInputRoom(e.target.value)}
                disabled={!isHost}
                className={cn(
                  "w-full bg-[#1a1a1a] border border-slate-700 rounded-2xl px-3 py-2 outline-none font-mono font-bold text-sm",
                  isHost ? "focus:border-slate-500" : "opacity-50 cursor-not-allowed"
                )}
              />
            </div>
          </div>

          {/* Show port for manual joining on laptops */}
          {isHost && serverPort > 0 && !isWan && (
            <div className="flex items-center gap-2 px-1 mt-1">
              <span className="text-xs text-slate-500 font-bold">PORT:</span>
              <span className="text-xs font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded-lg">{serverPort}</span>
              <span className="text-xs text-slate-600">— share IP + port + room with laptop players</span>
            </div>
          )}

          {/* Settings Boxes (Visuals) */}
          <div className="flex flex-col gap-3 mt-1 flex-1">
            <GameSettingsPanel
              isHost={isHost}
              gameMode={gameMode}
              setGameMode={setGameMode}
              selectedPacks={selectedPacks}
              setSelectedPacks={setSelectedPacks}
              timerSettings={timerSettings}
              setTimerSettings={setTimerSettings}
              customWordsText={customWordsText}
              setCustomWordsText={setCustomWordsText}
              customWordWeight={customWordWeight}
              setCustomWordWeight={setCustomWordWeight}
              customWordsArray={customWordsArray}
              language={language}
              setLanguage={setLanguage}
              clueType={clueType}
              setClueType={setClueType}
            />
          </div>

          {isHost && (
            <div className="flex justify-center gap-4 mt-auto">
              <button onMouseEnter={playLobbyHoverSfx} onClick={handleResetTeams} className="px-6 py-2 rounded-full border border-slate-500 hover:bg-slate-700 transition-colors text-sm font-bold">Reset teams</button>
              <button onMouseEnter={playLobbyHoverSfx} onClick={handleRandomizeTeams} className="px-6 py-2 rounded-full border border-slate-500 hover:bg-slate-700 transition-colors text-sm font-bold">Randomize teams</button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: RED TEAM / DUET SIDES */}
        {gameMode === 'classic' ? (
          <div className="flex flex-col gap-4">
            <div className="bg-slate-800 rounded-full py-2 text-center border-2 border-slate-600 font-bold tracking-widest text-sm shadow-md">
              RED TEAM
            </div>
            
            <div className="flex-1 bg-red-500/20 border-2 border-red-400 rounded-3xl p-4 flex flex-col items-center justify-between shadow-[0_0_20px_rgba(239,68,68,0.3)]">
              <div className="w-full text-center">
                <h3 className="font-bold mb-2 tracking-widest">OPERATIVES</h3>
                <div className="flex flex-col gap-2 min-h-[50px]">
                  {redOperatives.map(p => (
                    <div key={p.id} className="bg-red-600/50 px-4 py-2 rounded-xl text-center font-bold">
                      {p.name} {p.id === player?.id && '(You)'}
                    </div>
                  ))}
                </div>
              </div>
              <button 
                onMouseEnter={playLobbyHoverSfx}
                onClick={() => handleJoinTeam('red', 'operative')}
                disabled={!isConnected}
                className="mt-4 w-full py-2 bg-red-500 hover:bg-red-400 rounded-full font-bold text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              >
                {isConnected ? 'JOIN TEAM' : 'CONNECTING...'}
              </button>
            </div>

            <div className="flex-1 bg-red-400/20 border-2 border-red-300 rounded-3xl p-4 flex flex-col items-center justify-between shadow-[0_0_20px_rgba(248,113,113,0.3)]">
              <div className="w-full text-center">
                <h3 className="font-bold mb-2 tracking-widest">SPYMASTERS</h3>
                <div className="flex flex-col gap-2 min-h-[50px]">
                  {redSpymasters.map(p => (
                    <div key={p.id} className="bg-red-500/50 px-4 py-2 rounded-xl text-center font-bold">
                      {p.name} {p.id === player?.id && '(You)'}
                    </div>
                  ))}
                </div>
              </div>
              <button 
                onMouseEnter={playLobbyHoverSfx}
                onClick={() => handleJoinTeam('red', 'spymaster')}
                disabled={!isConnected}
                className="mt-4 w-full py-2 bg-red-500 hover:bg-red-400 rounded-full font-bold text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              >
                {isConnected ? 'JOIN TEAM' : 'CONNECTING...'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 h-full min-h-min">
            {/* DUET SIDE A */}
            <div className="flex-1 bg-green-500/20 border-2 border-green-400 rounded-3xl p-4 flex flex-col items-center shadow-[0_0_20px_rgba(34,197,94,0.3)] relative overflow-hidden group">
              <div className="absolute top-0 w-full h-10 bg-green-600/30 font-black text-center pt-2 text-white/80 tracking-widest text-sm z-0">
                SIDE A
              </div>
              <div className="w-full flex-1 flex flex-col items-center pt-10 z-10 min-h-[60px]">
                <div className="flex flex-col gap-2 w-full">
                  {redPlayers.map(p => (
                    <div key={p.id} className="bg-green-600/50 px-4 py-2 rounded-xl text-center font-bold border border-green-500/50">
                      {p.name} {p.id === player?.id && '(You)'}
                    </div>
                  ))}
                </div>
              </div>
              <button 
                onMouseEnter={playLobbyHoverSfx}
                onClick={() => handleJoinTeam('red', 'spymaster')}
                className="mt-4 w-full py-2 bg-[#e67e22] hover:bg-[#d35400] border-b-4 border-[#a04000] rounded-2xl font-black text-white shadow-lg transition-all hover:translate-y-[2px] hover:border-b-2 active:border-b-0 active:translate-y-1 tracking-widest z-10"
              >
                JOIN TEAM
              </button>
            </div>

            {/* DUET SIDE B */}
            <div className="flex-1 bg-teal-500/20 border-2 border-teal-400 rounded-3xl p-4 flex flex-col items-center shadow-[0_0_20px_rgba(20,184,166,0.3)] relative overflow-hidden group">
              <div className="absolute top-0 w-full h-10 bg-teal-600/30 font-black text-center pt-2 text-white/80 tracking-widest text-sm z-0">
                SIDE B
              </div>
              <div className="w-full flex-1 flex flex-col items-center pt-10 z-10 min-h-[60px]">
                <div className="flex flex-col gap-2 w-full">
                  {bluePlayers.map(p => (
                    <div key={p.id} className="bg-teal-600/50 px-4 py-2 rounded-xl text-center font-bold border border-teal-500/50">
                      {p.name} {p.id === player?.id && '(You)'}
                    </div>
                  ))}
                </div>
              </div>
              <button 
                onMouseEnter={playLobbyHoverSfx}
                onClick={() => handleJoinTeam('blue', 'spymaster')}
                className="mt-4 w-full py-2 bg-[#e67e22] hover:bg-[#d35400] border-b-4 border-[#a04000] rounded-2xl font-black text-white shadow-lg transition-all hover:translate-y-[2px] hover:border-b-2 active:border-b-0 active:translate-y-1 tracking-widest z-10"
              >
                JOIN TEAM
              </button>
            </div>
          </div>
        )}

      </div>

      {/* BOTTOM START BUTTON */}
      <div className="w-full max-w-[1400px] mx-auto mt-4">
        {isHost ? (
          <button 
            onMouseEnter={playLobbyHoverSfx}
            onClick={handleStartGame}
            className="w-full py-3 bg-[#22c55e] hover:bg-[#16a34a] rounded-full font-black text-xl tracking-widest text-white shadow-[0_10px_0_#15803d] hover:translate-y-1 hover:shadow-[0_5px_0_#15803d] transition-all"
          >
            START GAME
          </button>
        ) : (
          <div className="w-full py-3 bg-slate-800 rounded-full font-black text-xl tracking-widest text-slate-400 text-center shadow-inner cursor-not-allowed">
            WAITING FOR HOST TO START...
          </div>
        )}
      </div>

    </div>
  );
}
