import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useGameContext } from '../context/GameContext';
import { useI18n } from '../context/I18nContext';
import type { Player, Team, Role, CustomWordWeight, TimerSettings, ClueType } from '../../../shared/types';
import { ArrowLeft, Bot, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import GameSettingsPanel from '../components/GameSettingsPanel';
import { twMerge } from 'tailwind-merge';
import { getLocalServerPort, startHostBroadcast, stopHostBroadcast, getLocalIp } from '../utils/discovery';
import { playLobbyHoverSfx, playLobbyClickSfx, playMenuClickSfx, playMenuHoverSfx } from '../utils/sfx';
import { MODIFIERS } from '../../../shared/modifiers';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function LANLobby() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isHost = searchParams.get('host') === 'true';
  const isWan = searchParams.get('wan') === 'true';

  const { player, setPlayer, roomId, setRoomId, socket, setSocket, language, setLanguage } = useGameContext();
  const { t } = useI18n();
  
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
  
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
  } | null>(null);
  
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
  const [chaosMode, setChaosMode] = useState<boolean>(() => localStorage.getItem('host_chaosMode') === 'true');
  const [enabledModifiers, setEnabledModifiers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('host_enabledModifiers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return MODIFIERS.map(m => m.id);
  });

  useEffect(() => {
    if (isHost) {
      localStorage.setItem('host_gameMode', gameMode);
      localStorage.setItem('host_selectedPacks', JSON.stringify(selectedPacks));
      localStorage.setItem('host_clueType', clueType);
      localStorage.setItem('host_customWordsText', customWordsText);
      localStorage.setItem('host_customWordWeight', customWordWeight);
      localStorage.setItem('host_timerSettings', JSON.stringify(timerSettings));
      localStorage.setItem('host_chaosMode', String(chaosMode));
      localStorage.setItem('host_enabledModifiers', JSON.stringify(enabledModifiers));
    }
  }, [isHost, gameMode, selectedPacks, clueType, customWordsText, customWordWeight, timerSettings, chaosMode, enabledModifiers]);

  useEffect(() => {
    if (isHost && timerSettings.preset === 'off' && enabledModifiers.includes('critical-hit')) {
      setEnabledModifiers(prev => prev.filter(id => id !== 'critical-hit'));
    }
    if (isHost && gameMode === 'duet' && (enabledModifiers.includes('colorblind') || enabledModifiers.includes('the-intercept'))) {
      setEnabledModifiers(prev => prev.filter(id => id !== 'colorblind' && id !== 'the-intercept'));
    }
  }, [isHost, timerSettings.preset, gameMode, enabledModifiers]);

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

  const [ngrokUrl, setNgrokUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isHost || serverPort === 0) return;

    let active = true;
    const fetchStatus = () => {
      fetch(`http://${connectIp}:${serverPort}/api/ngrok-status`)
        .then(res => res.json())
        .then(data => {
          if (active) {
            if (data.active && data.publicUrl) {
              setNgrokUrl(data.publicUrl);
            } else {
              setNgrokUrl(null);
            }
          }
        })
        .catch(() => {
          if (active) setNgrokUrl(null);
        });
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isHost, serverPort, connectIp]);

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
      if (isHost && serverPort === 0) return;
      if (!isWan && (!connectIp || !inputRoom)) return;
      if (isWan && !inputRoom) return;

      if (socket) {
        socket.disconnect();
      }

      const serverUrlParam = searchParams.get('serverUrl');
      const socketUrl = (isWan && !isHost) 
        ? (serverUrlParam || import.meta.env.VITE_WAN_SERVER_URL || 'http://localhost:3000')
        : `http://${connectIp}:${serverPort}`;

      const newSocket = io(socketUrl, {
        reconnectionDelayMax: 10000,
        timeout: 10000,
        transports: isWan ? ['websocket'] : ['websocket', 'polling']
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
          newSocket.emit('join_room', { roomId: inputRoom, player: currentPlayer, isPublic: isWan });
        }
      });

      newSocket.on('disconnect', () => {
        setIsConnected(false);
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
          clueType,
          chaosMode,
          enabledModifiers
        }
      });
    }
  }, [gameMode, selectedPacks, timerSettings, customWordsText, customWordWeight, language, clueType, isHost, socket, roomId, chaosMode, enabledModifiers]);

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
      setChaosMode(!!settings.chaosMode);
      if (settings.enabledModifiers) {
        setEnabledModifiers(settings.enabledModifiers);
      }
    });
    
    return () => {
      socket.off('settings_updated');
    };
  }, [socket, isHost, setLanguage]);

  const handleJoinTeam = (team: Team, role: Role) => {
    if (!socket || !roomId || !isConnected) {
      setAlertModal({
        isOpen: true,
        title: t('alert_warning'),
        description: t('alert_not_connected')
      });
      return;
    }
    if (!name.trim()) {
      setAlertModal({
        isOpen: true,
        title: t('alert_warning'),
        description: t('alert_enter_name')
      });
      return;
    }

    const newPlayer: Player = {
      ...(player || {}),
      id: socket.id!,
      name,
      team,
      role
    };
    
    setPlayer(newPlayer);
    socket.emit('join_room', { roomId, player: newPlayer, explicitChange: true, isPublic: isWan });
    playLobbyClickSfx();
  };

  const handleWelcomeSubmit = () => {
    if (!name.trim()) return;
    localStorage.setItem('codenames_nickname', name.trim());
    setShowWelcomeModal(false);
    if (player && socket) {
      const updatedPlayer = { ...player, name };
      setPlayer(updatedPlayer);
      socket.emit('join_room', { roomId: inputRoom, player: updatedPlayer, isPublic: isWan });
    }
  };

  const handleStartGame = () => {
    if (!player || player.team === 'spectator') {
      setAlertModal({
        isOpen: true,
        title: t('alert_warning'),
        description: t('alert_join_team_first')
      });
      return;
    }
    if (socket && roomId) {
      socket.emit('start_game', { 
        roomId, 
        language, 
        gameMode, 
        timerSettings,
        selectedPacks,
        customWords: customWordsArray,
        customWordWeight,
        clueType,
        chaosMode,
        enabledModifiers
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

  const handleAddBot = (team: Team, role: Role) => {
    if (socket && roomId && isHost) {
      socket.emit('add_bot', { roomId, team, role });
      playLobbyClickSfx();
    }
  };

  const handleRemoveBot = (botId: string) => {
    if (socket && roomId && isHost) {
      socket.emit('remove_bot', { roomId, botId });
      playLobbyClickSfx();
    }
  };

  const renderPlayerEntry = (p: Player, colorClass: string) => (
    <div key={p.id} className={cn(colorClass, "px-2 py-1 lg:px-4 lg:py-2 rounded-xl text-center font-bold text-sm lg:text-base flex items-center justify-center gap-1.5 relative group/entry", p.isBot && isHost && "pr-8 lg:pr-10")}>
      {p.isBot && <Bot className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0 opacity-70" />}
      <span className="truncate">{p.name}</span>
      {p.id === player?.id && <span className="shrink-0">(You)</span>}
      {p.isBot && isHost && (
        <button
          onClick={(e) => { e.stopPropagation(); handleRemoveBot(p.id); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center opacity-0 group-hover/entry:opacity-100 transition-opacity shadow-md"
          title="Remove Bot"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  const blueOperatives = roomPlayers.filter(p => p.team === 'blue' && p.role === 'operative');
  const blueSpymasters = roomPlayers.filter(p => p.team === 'blue' && p.role === 'spymaster');
  const redOperatives = roomPlayers.filter(p => p.team === 'red' && p.role === 'operative');
  const redSpymasters = roomPlayers.filter(p => p.team === 'red' && p.role === 'spymaster');
  
  const redPlayers = roomPlayers.filter(p => p.team === 'red');
  const bluePlayers = roomPlayers.filter(p => p.team === 'blue');
  const spectators = roomPlayers.filter(p => p.team === 'spectator');

  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen bg-[#121212] flex flex-col p-3 lg:p-4 font-sans text-white lg:overflow-hidden">
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
            <h2 className="text-2xl font-black text-white tracking-wide">{t('host_disconnected')}</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              {t('host_left')}
            </p>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-red-500 rounded-full animate-shrink-bar" />
            </div>
            <button
              onClick={() => navigate('/')}
              className="mt-1 px-8 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-2xl font-bold text-white transition-colors text-sm tracking-widest"
            >
              {t('return_now')}
            </button>
          </div>
        </div>
      )}
      {/* Welcome Modal */}
      {showWelcomeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#333] border border-white/10 rounded-3xl p-6 lg:p-8 max-w-sm w-full shadow-2xl flex flex-col gap-4 text-center">
            <h2 className="text-xl font-bold text-white mb-2">{t('welcome_to_codenames')}</h2>
            <p className="text-slate-300 text-sm mb-4">{t('choose_nickname')}</p>
            <input 
              type="text" 
              placeholder={t('nickname')}
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
              {t('enter_game')}
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
      <div className="flex items-center mb-1 lg:mb-2" dir="ltr">
        <button onMouseEnter={playMenuHoverSfx} onClick={() => {
          playMenuClickSfx();
          if (isHost) stopHostBroadcast();
          navigate('/');
        }} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Main Content Layout */}
      <div className={cn("flex-1 max-w-[1400px] w-full mx-auto grid gap-3 lg:min-h-0", 
        gameMode === 'duet' ? "grid-cols-1 lg:grid-cols-[2fr_1fr]" : "grid-cols-1 lg:grid-cols-[1fr_2fr_1fr]"
      )}>
        
        {gameMode === 'classic' && (
          <div className="flex flex-col gap-2 lg:gap-3 lg:min-h-0 lg:h-full">
            <div className="bg-slate-800 rounded-full py-1.5 text-center border-2 border-slate-600 font-bold tracking-widest text-xs lg:text-sm shadow-md shrink-0 uppercase">
              {t('blue_team')}
            </div>
            
            <div className="flex-none lg:flex-1 bg-blue-500/20 border-2 border-blue-400 rounded-3xl p-3 lg:p-4 flex flex-col items-center justify-between shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              <div className="w-full text-center flex-1 flex flex-col lg:min-h-0 mb-3">
                <h3 className="font-bold mb-1.5 tracking-widest text-xs lg:text-sm">{t('operatives_role')}</h3>
                <div className="flex flex-col gap-1.5 overflow-y-auto lg:min-h-0 pr-1 scrollbar-thin">
                  {blueOperatives.map(p => renderPlayerEntry(p, 'bg-blue-600/50'))}
                </div>
              </div>
              <button 
                onMouseEnter={playLobbyHoverSfx}
                onClick={() => handleJoinTeam('blue', 'operative')}
                disabled={!isConnected}
                className="w-full py-2 bg-blue-500 hover:bg-blue-400 rounded-full font-bold text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 shrink-0 text-sm uppercase"
              >
                {isConnected ? t('join_team') : t('connecting_btn')}
              </button>
              {isHost && isConnected && (
                <button
                  onClick={() => handleAddBot('blue', 'operative')}
                  className="w-full py-1.5 mt-1 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-400/30 rounded-full font-bold text-blue-300 text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                >
                  <Bot className="w-3.5 h-3.5" /> Add Bot
                </button>
              )}
            </div>

            <div className="flex-none lg:flex-1 bg-blue-400/20 border-2 border-blue-300 rounded-3xl p-3 lg:p-4 flex flex-col items-center justify-between shadow-[0_0_20px_rgba(96,165,250,0.3)]">
              <div className="w-full text-center flex-1 flex flex-col lg:min-h-0 mb-3">
                <h3 className="font-bold mb-1.5 tracking-widest text-xs lg:text-sm">{t('spymasters_role')}</h3>
                <div className="flex flex-col gap-1.5 overflow-y-auto lg:min-h-0 pr-1 scrollbar-thin">
                  {blueSpymasters.map(p => renderPlayerEntry(p, 'bg-blue-500/50'))}
                </div>
              </div>
              <button 
                onMouseEnter={playLobbyHoverSfx}
                onClick={() => handleJoinTeam('blue', 'spymaster')}
                disabled={!isConnected}
                className="w-full py-2 bg-blue-500 hover:bg-blue-400 rounded-full font-bold text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 shrink-0 text-sm uppercase"
              >
                {isConnected ? t('join_team') : t('connecting_btn')}
              </button>
              {isHost && isConnected && (
                <button
                  onClick={() => handleAddBot('blue', 'spymaster')}
                  className="w-full py-1.5 mt-1 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-400/30 rounded-full font-bold text-blue-300 text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                >
                  <Bot className="w-3.5 h-3.5" /> Add Bot
                </button>
              )}
            </div>
          </div>
        )}

        {/* MIDDLE COLUMN: SETTINGS & SPECTATORS */}
        <div className="bg-[#242424] rounded-3xl p-3 lg:p-4 flex flex-col gap-2.5 shadow-xl relative lg:min-h-0 lg:overflow-hidden">
          
          {/* SPECTATORS POOL */}
          <div className="flex flex-col gap-1">
            <div className="text-center font-bold text-xs tracking-widest text-slate-400 border-b border-white/10 pb-1 uppercase">
              {t('spectators')}
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 min-h-[32px] max-h-[80px] overflow-y-auto py-1 scrollbar-thin">
              {spectators.length === 0 ? (
                <span className="text-slate-500 text-xs italic my-auto">{t('no_spectators')}</span>
              ) : (
                spectators.map(p => (
                  <div key={p.id} className="bg-slate-700/50 text-slate-300 px-2.5 py-0.5 rounded-full text-xs font-bold border border-slate-600">
                    {p.name} {p.id === player?.id && '(You)'}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="text-center font-bold text-base tracking-widest mt-1 border-b border-white/10 pb-1.5">
            {isWan ? t('online_multiplayer_settings') : t('lan_multiplayer_settings')}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-0.5 ml-2">{t('display_name')}</label>
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
                className="w-full bg-[#1a1a1a] border border-slate-700 rounded-xl px-2.5 py-1.5 outline-none focus:border-slate-500 font-bold text-sm"
              />
            </div>
            {isWan ? (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-0.5 ml-2">{t('invite_link')}</label>
                <input 
                  type="text" 
                  value={ngrokUrl ? `${ngrokUrl}/#/lan-lobby?wan=true&room=${encodeURIComponent(inputRoom)}&serverUrl=${encodeURIComponent(ngrokUrl)}` : (window.location.origin.includes('localhost') ? 'Detecting Ngrok...' : `${window.location.origin}/#/lan-lobby?wan=true&room=${encodeURIComponent(inputRoom)}`)}
                  readOnly
                  className="w-full bg-[#1a1a1a] border border-slate-700 rounded-xl px-2.5 py-1.5 outline-none font-mono font-bold text-[10px] opacity-70 cursor-default select-all text-blue-400 hover:opacity-100 transition-opacity"
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
                <label className="block text-[10px] font-bold text-slate-400 mb-0.5 ml-2">{t('host_ip')}</label>
                <input 
                  type="text" 
                  value={serverIp}
                  readOnly
                  className="w-full bg-[#1a1a1a] border border-slate-700 rounded-xl px-2.5 py-1.5 outline-none font-mono font-bold text-xs opacity-70 cursor-default select-all"
                />
              </div>
            )}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-0.5 ml-2">{t('room_id')}</label>
              <input 
                type="text" 
                value={inputRoom}
                onChange={(e) => setInputRoom(e.target.value)}
                disabled={!isHost}
                className={cn(
                  "w-full bg-[#1a1a1a] border border-slate-700 rounded-xl px-2.5 py-1.5 outline-none font-mono font-bold text-xs",
                  isHost ? "focus:border-slate-500" : "opacity-50 cursor-not-allowed"
                )}
              />
            </div>
          </div>

          {/* Show port for manual joining on laptops */}
          {isHost && serverPort > 0 && !isWan && (
            <div className="flex items-center gap-1.5 px-1 mt-0.5">
              <span className="text-[10px] text-slate-500 font-bold">{t('port_label')}</span>
              <span className="text-[10px] font-mono text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">{serverPort}</span>
              <span className="text-[9px] text-slate-600">{t('share_ip_port')}</span>
            </div>
          )}

          {/* Settings Boxes (Visuals) */}
          <div className="flex flex-col gap-3 mt-1 flex-1 overflow-y-auto pr-1 lg:min-h-0 scrollbar-thin">
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
              chaosMode={chaosMode}
              setChaosMode={setChaosMode}
              enabledModifiers={enabledModifiers}
              setEnabledModifiers={setEnabledModifiers}
            />
          </div>

          {isHost && (
            <div className="flex justify-center gap-4 mt-auto pt-2 border-t border-white/5">
              <button onMouseEnter={playLobbyHoverSfx} onClick={handleResetTeams} className="px-5 py-1.5 rounded-full border border-slate-500 hover:bg-slate-700 transition-colors text-xs font-bold">{t('reset_teams')}</button>
              <button onMouseEnter={playLobbyHoverSfx} onClick={handleRandomizeTeams} className="px-5 py-1.5 rounded-full border border-slate-500 hover:bg-slate-700 transition-colors text-xs font-bold">{t('randomize_teams')}</button>
            </div>
          )}
        </div>

        {gameMode === 'classic' ? (
          <div className="flex flex-col gap-2 lg:gap-3 lg:min-h-0 lg:h-full">
            <div className="bg-slate-800 rounded-full py-1.5 text-center border-2 border-slate-600 font-bold tracking-widest text-xs lg:text-sm shadow-md shrink-0 uppercase">
              {t('red_team')}
            </div>
            
            <div className="flex-none lg:flex-1 bg-red-500/20 border-2 border-red-400 rounded-3xl p-3 lg:p-4 flex flex-col items-center justify-between shadow-[0_0_20px_rgba(239,68,68,0.3)]">
              <div className="w-full text-center flex-1 flex flex-col lg:min-h-0 mb-3">
                <h3 className="font-bold mb-1.5 tracking-widest text-xs lg:text-sm">{t('operatives_role')}</h3>
                <div className="flex flex-col gap-1.5 overflow-y-auto lg:min-h-0 pr-1 scrollbar-thin">
                  {redOperatives.map(p => renderPlayerEntry(p, 'bg-red-600/50'))}
                </div>
              </div>
              <button 
                onMouseEnter={playLobbyHoverSfx}
                onClick={() => handleJoinTeam('red', 'operative')}
                disabled={!isConnected}
                className="w-full py-2 bg-red-500 hover:bg-red-400 rounded-full font-bold text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 shrink-0 text-sm uppercase"
              >
                {isConnected ? t('join_team') : t('connecting_btn')}
              </button>
              {isHost && isConnected && (
                <button
                  onClick={() => handleAddBot('red', 'operative')}
                  className="w-full py-1.5 mt-1 bg-red-500/20 hover:bg-red-500/40 border border-red-400/30 rounded-full font-bold text-red-300 text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                >
                  <Bot className="w-3.5 h-3.5" /> Add Bot
                </button>
              )}
            </div>

            <div className="flex-none lg:flex-1 bg-red-400/20 border-2 border-red-300 rounded-3xl p-3 lg:p-4 flex flex-col items-center justify-between shadow-[0_0_20px_rgba(248,113,113,0.3)]">
              <div className="w-full text-center flex-1 flex flex-col lg:min-h-0 mb-3">
                <h3 className="font-bold mb-1.5 tracking-widest text-xs lg:text-sm">{t('spymasters_role')}</h3>
                <div className="flex flex-col gap-1.5 overflow-y-auto lg:min-h-0 pr-1 scrollbar-thin">
                  {redSpymasters.map(p => renderPlayerEntry(p, 'bg-red-500/50'))}
                </div>
              </div>
              <button 
                onMouseEnter={playLobbyHoverSfx}
                onClick={() => handleJoinTeam('red', 'spymaster')}
                disabled={!isConnected}
                className="w-full py-2 bg-red-500 hover:bg-red-400 rounded-full font-bold text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 shrink-0 text-sm uppercase"
              >
                {isConnected ? t('join_team') : t('connecting_btn')}
              </button>
              {isHost && isConnected && (
                <button
                  onClick={() => handleAddBot('red', 'spymaster')}
                  className="w-full py-1.5 mt-1 bg-red-500/20 hover:bg-red-500/40 border border-red-400/30 rounded-full font-bold text-red-300 text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                >
                  <Bot className="w-3.5 h-3.5" /> Add Bot
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 lg:gap-3 lg:min-h-0 lg:h-full">
            {/* DUET SIDE A */}
            <div className="flex-none lg:flex-1 bg-green-500/20 border-2 border-green-400 rounded-3xl p-3 lg:p-4 flex flex-col items-center justify-between shadow-[0_0_20px_rgba(34,197,94,0.3)] relative overflow-hidden group">
              <div className="absolute top-0 w-full h-8 bg-green-600/30 font-black text-center pt-1.5 text-white/80 tracking-widest text-sm z-0">
                {t('side_a')}
              </div>
              <div className="w-full text-center pt-8 z-10 mb-2 flex-1 flex flex-col lg:min-h-0">
                <div className="flex flex-col gap-1.5 w-full overflow-y-auto lg:min-h-0 pr-1 scrollbar-thin">
                  {redPlayers.map(p => renderPlayerEntry(p, 'bg-green-600/50 border border-green-500/50'))}
                </div>
              </div>
              <button 
                onMouseEnter={playLobbyHoverSfx}
                onClick={() => handleJoinTeam('red', 'spymaster')}
                className="w-full py-2 bg-[#e67e22] hover:bg-[#d35400] border-b-4 border-[#a04000] rounded-2xl font-black text-white shadow-lg transition-all hover:translate-y-[2px] hover:border-b-2 active:border-b-0 active:translate-y-1 tracking-widest z-10 shrink-0 text-sm uppercase"
              >
                {t('join_team')}
              </button>
              {isHost && isConnected && (
                <button
                  onClick={() => handleAddBot('red', 'spymaster')}
                  className="w-full py-1.5 mt-1 bg-green-500/20 hover:bg-green-500/40 border border-green-400/30 rounded-full font-bold text-green-300 text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 z-10"
                >
                  <Bot className="w-3.5 h-3.5" /> Add Bot
                </button>
              )}
            </div>

            {/* DUET SIDE B */}
            <div className="flex-none lg:flex-1 bg-teal-500/20 border-2 border-teal-400 rounded-3xl p-3 lg:p-4 flex flex-col items-center justify-between shadow-[0_0_20px_rgba(20,184,166,0.3)] relative overflow-hidden group">
              <div className="absolute top-0 w-full h-8 bg-teal-600/30 font-black text-center pt-1.5 text-white/80 tracking-widest text-sm z-0">
                {t('side_b')}
              </div>
              <div className="w-full text-center pt-8 z-10 mb-2 flex-1 flex flex-col lg:min-h-0">
                <div className="flex flex-col gap-1.5 w-full overflow-y-auto lg:min-h-0 pr-1 scrollbar-thin">
                  {bluePlayers.map(p => renderPlayerEntry(p, 'bg-teal-600/50 border border-teal-500/50'))}
                </div>
              </div>
              <button 
                onMouseEnter={playLobbyHoverSfx}
                onClick={() => handleJoinTeam('blue', 'spymaster')}
                className="w-full py-2 bg-[#e67e22] hover:bg-[#d35400] border-b-4 border-[#a04000] rounded-2xl font-black text-white shadow-lg transition-all hover:translate-y-[2px] hover:border-b-2 active:border-b-0 active:translate-y-1 tracking-widest z-10 shrink-0 text-sm uppercase"
              >
                {t('join_team')}
              </button>
              {isHost && isConnected && (
                <button
                  onClick={() => handleAddBot('blue', 'spymaster')}
                  className="w-full py-1.5 mt-1 bg-teal-500/20 hover:bg-teal-500/40 border border-teal-400/30 rounded-full font-bold text-teal-300 text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 z-10"
                >
                  <Bot className="w-3.5 h-3.5" /> Add Bot
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* BOTTOM START BUTTON */}
      <div className="w-full max-w-[1400px] mx-auto mt-2.5 lg:mt-3 shrink-0">
        {isHost ? (
          <button 
            onMouseEnter={playLobbyHoverSfx}
            onClick={handleStartGame}
            className="w-full py-2.5 bg-[#22c55e] hover:bg-[#16a34a] rounded-full font-black text-lg lg:text-xl tracking-widest text-white shadow-[0_8px_0_#15803d] hover:translate-y-1 hover:shadow-[0_4px_0_#15803d] transition-all uppercase"
          >
            {t('start_game')}
          </button>
        ) : (
          <div className="w-full py-2.5 bg-slate-800 rounded-full font-black text-lg lg:text-xl tracking-widest text-slate-400 text-center shadow-inner cursor-not-allowed uppercase">
            {t('waiting_for_host_start')}
          </div>
        )}
      </div>

      {/* Reusable Custom Alert Modal */}
      {alertModal && alertModal.isOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1e1e1e] border-2 border-slate-700/60 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center flex flex-col items-center gap-5 animate-scale-up z-[200]">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 text-2xl font-bold select-none">
              ⚠️
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase leading-tight">
              {alertModal.title}
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed font-bold">
              {alertModal.description}
            </p>
            <div className="flex w-full mt-2">
              <button
                onClick={() => setAlertModal(null)}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-black rounded-2xl transition-all shadow-lg shadow-amber-500/20 active:scale-95 text-sm uppercase tracking-wider cursor-pointer"
              >
                {t('ok')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
