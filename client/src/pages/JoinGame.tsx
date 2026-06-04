import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { startListening, stopListening, getDiscoveredRooms, scanForRoomsHTTP, type DiscoveredRoom } from '../utils/discovery';
import { ArrowLeft, RefreshCw, Wifi } from 'lucide-react';

export default function JoinGame() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<DiscoveredRoom[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const httpRoomsRef = useRef<DiscoveredRoom[]>([]);

  useEffect(() => {
    const warningTimer = setTimeout(() => {
      setShowWarning(true);
    }, 5000);

    return () => clearTimeout(warningTimer);
  }, []);

  useEffect(() => {
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
  }, []);

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col p-4 sm:p-6 font-sans text-white">
      <div className="flex items-center mb-8">
        <button onClick={() => navigate('/')} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-black ml-4 tracking-widest">JOIN GAME</h1>
      </div>

      <div className="max-w-2xl w-full mx-auto flex-1 flex flex-col gap-4">
        <div className="bg-[#242424] rounded-3xl p-6 lg:p-8 flex flex-col flex-1 shadow-xl relative overflow-hidden">
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

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {rooms.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 text-center">
                <div className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin"></div>
                <p className="font-bold">Scanning for local games...</p>
                <p className="text-sm">Make sure the host is on the same Wi-Fi network.</p>
                
                {showWarning && (
                  <div className="mt-8 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl text-orange-400 max-w-sm transition-opacity duration-1000 ease-in-out opacity-100">
                    <p className="text-sm font-semibold">
                      No rooms found? Ensure the device hosting the game is also the device providing the mobile hotspot!
                    </p>
                  </div>
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
                      <p className="text-slate-400 text-sm">Hosted by <span className="text-blue-400 font-bold">{room.hostName}</span></p>
                    </div>
                    <div className="bg-blue-500/20 text-blue-400 px-4 py-2 rounded-xl font-bold group-hover:bg-blue-500 group-hover:text-white transition-colors">
                      JOIN
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Manual join fallback — for laptops/devices where UDP discovery doesn't work */}
        <ManualJoin navigate={navigate} />
      </div>
    </div>
  );
}

function ManualJoin({ navigate }: { navigate: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('3000');
  const [room, setRoom] = useState('');

  const handleJoin = () => {
    if (!ip.trim() || !port.trim() || !room.trim()) return;
    navigate(`/lan-lobby?ip=${ip.trim()}&port=${port.trim()}&room=${encodeURIComponent(room.trim())}`);
  };

  return (
    <div className="bg-[#1e1e1e] border border-slate-700 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-6 py-4 flex items-center justify-between text-slate-400 hover:text-white transition-colors"
      >
        <span className="font-bold text-sm tracking-widest">JOIN MANUALLY (LAPTOP / DESKTOP)</span>
        <span className="text-lg">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-6 pb-6 flex flex-col gap-3">
          <p className="text-slate-500 text-xs">Enter the host's details directly if auto-discovery isn't finding the room.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Host IP Address</label>
              <input
                type="text"
                placeholder="e.g. 192.168.1.5"
                value={ip}
                onChange={e => setIp(e.target.value)}
                className="w-full bg-[#2a2a2a] border border-slate-600 rounded-xl px-3 py-2 text-white font-mono text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Port</label>
              <input
                type="number"
                placeholder="3000"
                value={port}
                onChange={e => setPort(e.target.value)}
                className="w-full bg-[#2a2a2a] border border-slate-600 rounded-xl px-3 py-2 text-white font-mono text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Room ID</label>
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
            disabled={!ip.trim() || !port.trim() || !room.trim()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            JOIN ROOM
          </button>
        </div>
      )}
    </div>
  );
}
