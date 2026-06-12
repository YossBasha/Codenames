import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { startListening, stopListening, getDiscoveredRooms, scanForRoomsHTTP, type DiscoveredRoom } from '../utils/discovery';
import { useI18n } from '../context/I18nContext';
import { ArrowLeft, RefreshCw, Wifi } from 'lucide-react';

export default function JoinGame() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'local' | 'online'>('local');
  const [rooms, setRooms] = useState<DiscoveredRoom[]>([]);
  const [publicRooms, setPublicRooms] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [isFetchingPublic, setIsFetchingPublic] = useState(false);
  const httpRoomsRef = useRef<DiscoveredRoom[]>([]);

  useEffect(() => {
    if (activeTab !== 'local') return;
    
    const warningTimer = setTimeout(() => {
      setShowWarning(true);
    }, 5000);

    return () => clearTimeout(warningTimer);
  }, [activeTab]);

  const fetchPublicRooms = async () => {
    setIsFetchingPublic(true);
    try {
      const WAN_SERVER_URL = import.meta.env.VITE_WAN_SERVER_URL || 'http://localhost:3000';
      const res = await fetch(`${WAN_SERVER_URL}/api/public-rooms`, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPublicRooms(data.rooms || []);
      }
    } catch (e) {
      console.error('Failed to fetch public rooms', e);
    } finally {
      setIsFetchingPublic(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'online') {
      fetchPublicRooms();
      const interval = setInterval(fetchPublicRooms, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  useEffect(() => {
    // Always scan local in background or only when active? Only when active to save battery.
    if (activeTab !== 'local') return;

    // Start UDP listening
    startListening();

    // UDP poll — every 1 second
    const udpInterval = setInterval(async () => {
      const udpRooms = await getDiscoveredRooms();
      // Merge UDP + HTTP rooms, deduplicate by roomID
      const merged = new Map<string, DiscoveredRoom>();
      for (const r of udpRooms) merged.set(r.roomID, r);
      for (const r of httpRoomsRef.current) {
        if (!merged.has(r.roomID)) merged.set(r.roomID, r);
      }
      const all = Array.from(merged.values());
      setRooms(all);
      if (all.length > 0) setIsScanning(false);
    }, 1000);

    // HTTP scan fallback — every 3 seconds (handles Android hosts where UDP fails)
    const httpInterval = setInterval(async () => {
      const httpRooms = await scanForRoomsHTTP();
      httpRoomsRef.current = httpRooms;
    }, 3000);
    // Run one HTTP scan immediately
    scanForRoomsHTTP().then(r => { httpRoomsRef.current = r; });

    return () => {
      clearInterval(udpInterval);
      clearInterval(httpInterval);
      stopListening();
    };
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col p-4 sm:p-6 font-sans text-white">
      <div className="relative flex items-center justify-center mb-6 min-h-[48px]">
        <button onClick={() => navigate('/')} className="absolute left-0 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-center text-2xl font-black tracking-widest text-white">{t('join_game')}</h1>
      </div>

      <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 mt-6 pb-12 flex-1">
        
        {/* Tabs */}
        <div className="flex bg-slate-800/50 p-1 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
          <button
            onClick={() => setActiveTab('local')}
            className={`flex-1 py-3 text-sm sm:text-base font-bold rounded-xl transition-all ${activeTab === 'local' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
          >
            {t('local_room')}
          </button>
          <button
            onClick={() => setActiveTab('online')}
            className={`flex-1 py-3 text-sm sm:text-base font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'online' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 cursor-pointer'
            }`}
          >
            <Wifi className="w-4 h-4" />
            {t('online_room')}
          </button>
        </div>

        {activeTab === 'local' ? (
          <div className="bg-[#242424] rounded-3xl p-6 lg:p-8 flex flex-col min-h-[450px] shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Wifi className={`w-5 h-5 ${isScanning ? 'text-blue-400 animate-pulse' : 'text-green-400'}`} />
                LAN Discovery
              </h2>
              <button 
                onClick={() => {
                  setRooms([]);
                  setIsScanning(true);
                }}
                className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700"
              >
                <RefreshCw className={`w-5 h-5 ${isScanning ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {showWarning && rooms.length === 0 && (
              <div className="mb-6 p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-2xl">
                <h3 className="text-yellow-400 font-bold mb-1 flex items-center gap-2">
                  <span className="text-xl">⚠️</span> {t('auto_discovery_warning')}
                </h3>
                <p className="text-yellow-400/80 text-sm">
                  {t('wifi_warning')}
                </p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {rooms.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 text-center">
                  {isScanning ? (
                    <>
                      <div className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin"></div>
                      <p className="font-bold">{t('scanning_local')}</p>
                    </>
                  ) : (
                    <p className="font-bold">{t('no_local_rooms')}</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {rooms.map((room) => (
                    <button
                      key={room.roomID}
                      onClick={() => navigate(`/lan-lobby?ip=${room.hostIP}&port=${room.port}&room=${encodeURIComponent(room.roomID)}`)}
                      className="w-full text-left bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-blue-500 transition-all rounded-2xl p-4 flex items-center justify-between group"
                    >
                      <div>
                        <h3 className="font-bold text-lg text-white mb-1">{room.roomID}</h3>
                        <p className="text-slate-400 text-sm">{t('hosted_by')} <span className="text-blue-400 font-bold">{room.hostName}</span></p>
                      </div>
                      <div className="bg-blue-500/20 text-blue-400 px-4 py-2 rounded-xl font-bold group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        {t('join')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-[#242424] rounded-3xl p-6 lg:p-8 flex flex-col min-h-[450px] shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Wifi className="w-5 h-5 text-green-400" />
                {t('public_online_rooms')}
              </h2>
              <button 
                onClick={fetchPublicRooms}
                className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700"
              >
                <RefreshCw className={`w-5 h-5 ${isFetchingPublic ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {publicRooms.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 text-center">
                  {isFetchingPublic ? (
                    <>
                      <div className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin"></div>
                      <p className="font-bold">{t('fetching_online')}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold">{t('no_public_rooms')}</p>
                      <p className="text-sm">{t('why_not_host')}</p>
                      <button 
                        onClick={() => navigate('/lan-lobby?host=true&wan=true')}
                        className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white transition-colors"
                      >
                        {t('host_online_room')}
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {publicRooms.map((room) => (
                    <button
                      key={room.roomID}
                      onClick={() => {
                        const urlParam = room.serverUrl ? `&serverUrl=${encodeURIComponent(room.serverUrl)}` : '';
                        navigate(`/lan-lobby?wan=true&room=${encodeURIComponent(room.roomID)}${urlParam}`);
                      }}
                      className="w-full text-left bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-blue-500 transition-all rounded-2xl p-4 flex items-center justify-between group"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-white">{room.roomID}</h3>
                          {room.gameStarted && (
                            <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded font-black tracking-widest">{t('in_progress')}</span>
                          )}
                        </div>
                        <p className="text-slate-400 text-sm">
                          {t('hosted_by')} <span className="text-blue-400 font-bold">{room.hostName}</span>
                          <span className="mx-2">•</span>
                          {room.players} {t('players_count')}
                        </p>
                      </div>
                      <div className="bg-blue-500/20 text-blue-400 px-4 py-2 rounded-xl font-bold group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        {t('join')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Manual join fallback */}
        <ManualJoin navigate={navigate} activeTab={activeTab} />
      </div>
    </div>
  );
}

function ManualJoin({ navigate, activeTab }: { navigate: (path: string) => void, activeTab: 'local'|'online' }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('3000');
  const [room, setRoom] = useState('');
  const [serverUrl, setServerUrl] = useState('');

  const handleJoin = () => {
    if (activeTab === 'online') {
      if (!room.trim()) return;
      const urlParam = serverUrl.trim() ? `&serverUrl=${encodeURIComponent(serverUrl.trim())}` : '';
      navigate(`/lan-lobby?wan=true&room=${encodeURIComponent(room.trim())}${urlParam}`);
    } else {
      if (!ip.trim() || !port.trim() || !room.trim()) return;
      navigate(`/lan-lobby?ip=${ip.trim()}&port=${port.trim()}&room=${encodeURIComponent(room.trim())}`);
    }
  };

  const handleServerUrlChange = (value: string) => {
    setServerUrl(value);
    // Auto-parse pasted invite links
    try {
      if (value.includes('?') && (value.includes('room=') || value.includes('serverUrl='))) {
        const urlPart = value.substring(value.indexOf('?'));
        const searchParams = new URLSearchParams(urlPart);
        const roomParam = searchParams.get('room');
        const serverUrlParam = searchParams.get('serverUrl');
        if (roomParam) setRoom(roomParam);
        if (serverUrlParam) setServerUrl(serverUrlParam);
      }
    } catch (e) {}
  };

  return (
    <div className="bg-[#1e1e1e] border border-slate-700 rounded-2xl overflow-hidden mt-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-6 py-4 flex items-center justify-between text-slate-400 hover:text-white transition-colors"
      >
        <span className="font-bold text-sm tracking-widest">{activeTab === 'online' ? t('join_private_online') : t('join_manually')}</span>
        <span className="text-lg">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-6 pb-6 flex flex-col gap-3">
          {activeTab === 'local' ? (
            <>
              <p className="text-slate-500 text-xs">{t('enter_host_details')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">{t('host_ip')}</label>
                  <input
                    type="text"
                    placeholder="e.g. 192.168.1.5"
                    value={ip}
                    onChange={e => setIp(e.target.value)}
                    className="w-full bg-[#2a2a2a] border border-slate-600 rounded-xl px-3 py-2 text-white font-mono text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">{t('port')}</label>
                  <input
                    type="number"
                    placeholder="3000"
                    value={port}
                    onChange={e => setPort(e.target.value)}
                    className="w-full bg-[#2a2a2a] border border-slate-600 rounded-xl px-3 py-2 text-white font-mono text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-slate-500 text-xs">{t('enter_exact_room_id')}</p>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Server URL / Invite Link</label>
                <input
                  type="text"
                  placeholder="Paste Invite Link or e.g. https://xxxx.ngrok-free.app"
                  value={serverUrl}
                  onChange={e => handleServerUrlChange(e.target.value)}
                  className="w-full bg-[#2a2a2a] border border-slate-600 rounded-xl px-3 py-2 text-white font-mono text-xs outline-none focus:border-blue-500"
                />
              </div>
            </>
          )}
          
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">{t('room_id')}</label>
            <input
              type="text"
              placeholder="e.g. Room-4321"
              value={room}
              onChange={e => setRoom(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
              className="w-full bg-[#2a2a2a] border border-slate-600 rounded-xl px-3 py-2 text-white font-mono text-sm outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleJoin}
            disabled={activeTab === 'online' ? !room.trim() : (!ip.trim() || !port.trim() || !room.trim())}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('join_room_button')}
          </button>
        </div>
      )}
    </div>
  );
}
