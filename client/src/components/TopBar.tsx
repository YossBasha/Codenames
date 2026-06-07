import type { Team, ClueType } from '../../../shared/types';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../utils';
import { MODIFIERS } from '../../../shared/modifiers';

interface TopBarProps {
  redScore: number;
  blueScore: number;
  currentTurn: Team;
  currentPhase: 'spymaster' | 'operative';
  playerTeam?: Team;
  playerRole?: string;
  gameMode?: 'classic' | 'duet';
  timerTokens?: number;
  remainingGreens?: number;
  timeRemaining?: number;
  isTimerEnabled?: boolean;
  onSubmitCue?: (cue: string, num: number) => void;
  showSpymasterToggle?: boolean;
  onToggleSpymaster?: () => void;
  isSpymaster?: boolean;
  clueTargetCount?: number;
  amHost?: boolean;
  onRestartGame?: () => void;
  clueType?: ClueType;
  activeModifier?: string | null;
  isRTL?: boolean;
}

export default function TopBar({
  redScore,
  blueScore,
  currentTurn,
  currentPhase,
  playerTeam,
  playerRole,
  gameMode = 'classic',
  timerTokens = 9,
  remainingGreens,
  timeRemaining = 0,
  isTimerEnabled = false,
  showSpymasterToggle,
  onToggleSpymaster,
  isSpymaster,
  amHost = false,
  onRestartGame,
  activeModifier
}: TopBarProps) {
  const navigate = useNavigate();

  const isActiveSpymaster = currentPhase === 'spymaster' && (
    (gameMode === 'classic' && playerTeam === currentTurn && playerRole === 'spymaster') ||
    (gameMode === 'duet' && playerTeam === currentTurn)
  );

  return (
    <div className="w-full shrink-0 flex flex-row items-center justify-between py-1 px-2.5 sm:py-1.5 sm:px-4 bg-slate-900/50 backdrop-blur-md shadow-md gap-2 sm:gap-4">
      <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
        <button 
          onClick={() => navigate('/')}
          className="p-1 sm:p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </button>
        {gameMode === 'classic' ? (
          <div className="flex items-center gap-2 sm:gap-4 bg-slate-800/80 rounded-xl p-1 sm:p-1.5 font-black text-xs sm:text-sm shadow-inner ring-1 ring-white/5">
            <div className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-md transition-all duration-300 ${currentTurn === 'red' ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/40 scale-105 sm:scale-110 ring-1 ring-red-400/50' : 'text-red-500 hover:bg-red-500/10'}`}>
              {redScore}
            </div>
            <span className="text-slate-500 font-medium">-</span>
            <div className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-md transition-all duration-300 ${currentTurn === 'blue' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/40 scale-105 sm:scale-110 ring-1 ring-blue-400/50' : 'text-blue-500 hover:bg-blue-500/10'}`}>
              {blueScore}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-800 rounded-lg p-1 sm:p-1.5 font-bold text-xs sm:text-sm text-lime-400">
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-lime-500 shadow-[0_0_10px_#84cc16]"></div>
            <span className="whitespace-nowrap">
              {remainingGreens !== undefined ? `${remainingGreens} GREEN` : `TOKENS: ${timerTokens}`}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col items-center gap-0.5 text-center px-1">
        <div className="flex items-center gap-1 sm:gap-2">
          {isTimerEnabled && (
            <div className="text-sm sm:text-xl lg:text-2xl font-black text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]">
              {timeRemaining}s
            </div>
          )}

          {activeModifier && (() => {
            const mod = MODIFIERS.find(m => m.id === activeModifier);
            if (!mod) return null;
            return (
              <div className="relative group cursor-pointer z-50">
                <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 transition-all rounded-full px-2 py-0.5 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                  <span className="text-[9px] sm:text-xs">🌀</span>
                  <span className="text-[7px] sm:text-[9px] font-black tracking-widest text-red-400 uppercase">{mod.name}</span>
                </div>
                
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-slate-950/95 border border-red-500/30 rounded-2xl p-4 shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
                  <div className="flex items-center gap-2 mb-2 text-red-400">
                    <span className="text-base">🌀</span>
                    <h4 className="font-black tracking-wider text-xs uppercase">{mod.name}</h4>
                  </div>
                  <p className="text-[11px] font-bold text-slate-300 leading-normal">{mod.description}</p>
                  <div className="mt-2 pt-2 border-t border-white/5 text-[9px] font-black text-slate-500 tracking-wider uppercase text-center">
                    Category: {mod.category}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
        <div className="text-xs xs:text-sm sm:text-base lg:text-lg font-black tracking-tight truncate max-w-full">
          {gameMode === 'classic' ? (
            <>
              <span className={cn(
                "transition-colors duration-300",
                currentTurn === 'red' ? 'text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-rose-600' : 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600'
              )}>
                {currentTurn === 'red' ? 'RED' : 'BLUE'}
              </span> TURN
            </>
          ) : (
            <>
              <span className={currentTurn === 'red' ? 'text-lime-400' : 'text-green-400'}>
                {currentTurn === 'red' ? 'SIDE A' : 'SIDE B'}
              </span>
              <span className="hidden sm:inline"> (Gives Clue)</span>
            </>
          )}
        </div>
        {gameMode !== 'duet' && (
          <div className="text-[8px] sm:text-[10px] font-bold text-slate-400 mt-0 uppercase tracking-widest whitespace-nowrap">
            {currentPhase === 'spymaster' ? 'Spymaster' : 'Operative'}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-3 shrink-0">
        {amHost && (
          <button
            onClick={onRestartGame}
            className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-lg shadow-amber-600/20 whitespace-nowrap text-[10px] sm:text-xs cursor-pointer"
          >
            New Game
          </button>
        )}
        {isActiveSpymaster ? (
          <div className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 font-bold rounded-lg text-[9px] sm:text-xs whitespace-nowrap animate-pulse">
            Giving Clue...
          </div>
        ) : currentPhase === 'spymaster' ? (
          <div className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-slate-800 text-slate-400 font-bold rounded-lg text-[9px] sm:text-xs animate-pulse whitespace-nowrap">
            {gameMode === 'classic' 
              ? 'Waiting for Spymaster...' 
              : `Waiting for Side ${currentTurn === 'red' ? 'A' : 'B'}...`}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2">
            {showSpymasterToggle && (
              <button
                onClick={onToggleSpymaster}
                className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg font-bold transition-all text-[10px] sm:text-xs cursor-pointer ${
                  isSpymaster 
                    ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/50' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600'
                }`}
              >
                {isSpymaster ? 'Hide Spymaster View' : 'Spymaster View'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
