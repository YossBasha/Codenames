import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useGameContext } from '../context/GameContext';
import { playMenuHoverSfx, playMenuClickSfx } from '../utils/sfx';

export default function Home() {
  const navigate = useNavigate();
  const { socket, setSocket } = useGameContext();

  useEffect(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  }, [socket, setSocket]);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-red-500/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]" />



      <div className="z-10 flex flex-col items-center gap-8 w-full max-w-md glass p-8 rounded-3xl">
        <div className="text-center">
          <h1 className="text-5xl font-black mb-2 tracking-tight bg-gradient-to-r from-red-500 to-blue-500 bg-clip-text text-transparent">
            CODENAMES
          </h1>
          <p className="text-slate-400 font-medium">Top Secret Word Game</p>
        </div>

        <div className="flex flex-col w-full gap-4 mt-8">
          <button
            onMouseEnter={playMenuHoverSfx}
            onClick={() => { playMenuClickSfx(); navigate('/pass-and-play'); }}
            className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 rounded-xl font-bold text-lg shadow-lg shadow-purple-500/25 transition-all transform hover:-translate-y-1"
          >
            Pass & Play
          </button>
          
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-700"></div>
            <span className="flex-shrink-0 mx-4 text-slate-500 text-sm font-bold">LAN MULTIPLAYER</span>
            <div className="flex-grow border-t border-slate-700"></div>
          </div>

          <div className="flex gap-4">
            <button
              onMouseEnter={playMenuHoverSfx}
              onClick={() => { playMenuClickSfx(); navigate('/lan-lobby?host=true'); }}
              className="flex-1 py-4 px-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl font-bold text-lg transition-all transform hover:-translate-y-1"
            >
              Host Game
            </button>
            <button
              onMouseEnter={playMenuHoverSfx}
              onClick={() => { playMenuClickSfx(); navigate('/join-game'); }}
              className="flex-1 py-4 px-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl font-bold text-lg transition-all transform hover:-translate-y-1"
            >
              Join Game
            </button>
          </div>
        </div>
      </div>

      {/* Version badge */}
      <div className="z-10 mt-6 text-slate-600 text-xs font-mono tracking-widest select-none">
        v{__APP_VERSION__}
      </div>
    </div>
  );
}
