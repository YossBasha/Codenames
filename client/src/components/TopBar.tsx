import { useState, useEffect } from 'react';
import type { Team } from '../../../shared/types';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
  onSubmitCue,
  showSpymasterToggle,
  onToggleSpymaster,
  isSpymaster,
  clueTargetCount = 0,
  amHost = false,
  onRestartGame
}: TopBarProps) {
  const navigate = useNavigate();
  const [cueInput, setCueInput] = useState('');
  const [numInput, setNumInput] = useState<number | ''>('');

  useEffect(() => {
    if (clueTargetCount > 0) {
      setNumInput(clueTargetCount);
    }
  }, [clueTargetCount]);

  const handleSubmitCue = (e: React.FormEvent) => {
    e.preventDefault();
    if (cueInput.trim().length > 0 && numInput !== '' && onSubmitCue) {
      onSubmitCue(cueInput, Number(numInput));
      setCueInput('');
      setNumInput('');
    }
  };

  const isActiveSpymaster = currentPhase === 'spymaster' && (
    (gameMode === 'classic' && playerTeam === currentTurn && playerRole === 'spymaster') ||
    (gameMode === 'duet' && playerTeam === currentTurn)
  );

  return (
    <div className="w-full flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-900/50 backdrop-blur-md shadow-md gap-4">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/')}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        {gameMode === 'classic' ? (
          <div className="flex items-center gap-4 bg-slate-800 rounded-lg p-2 font-bold text-lg">
            <div className={`px-4 py-1 rounded-md ${currentTurn === 'red' ? 'bg-red-500 text-white' : 'text-red-500'}`}>
              {redScore}
            </div>
            <span className="text-slate-400">-</span>
            <div className={`px-4 py-1 rounded-md ${currentTurn === 'blue' ? 'bg-blue-500 text-white' : 'text-blue-500'}`}>
              {blueScore}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-2 font-bold text-lg text-lime-400">
            <div className="w-4 h-4 rounded-full bg-lime-500 shadow-[0_0_10px_#84cc16]"></div>
            {remainingGreens !== undefined ? `${remainingGreens} GREEN` : `TOKENS: ${timerTokens}`}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center">
        {isTimerEnabled && (
          <div className="text-3xl font-black text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]">
            {timeRemaining}s
          </div>
        )}
        <div className="text-xl font-bold">
          {gameMode === 'classic' ? (
            <>
              <span className={currentTurn === 'red' ? 'text-red-500' : 'text-blue-500'}>
                {currentTurn === 'red' ? 'RED' : 'BLUE'}
              </span> TURN
            </>
          ) : (
            <>
              <span className={currentTurn === 'red' ? 'text-lime-400' : 'text-green-400'}>
                {currentTurn === 'red' ? 'SIDE A (Gives Clue)' : 'SIDE B (Gives Clue)'}
              </span>
            </>
          )}
        </div>
        {gameMode !== 'duet' && (
          currentPhase === 'spymaster' ? (
            <div className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">
              Spymaster Phase
            </div>
          ) : (
            <div className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">
              Operative Phase
            </div>
          )
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 w-full sm:w-auto">
        {amHost && (
          <button
            onClick={onRestartGame}
            className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-lg shadow-amber-600/20 whitespace-nowrap text-xs sm:text-base"
          >
            New Game
          </button>
        )}
        {isActiveSpymaster ? (
          <form onSubmit={handleSubmitCue} className="flex gap-1 sm:gap-2 bg-slate-800 p-1 sm:p-1.5 rounded-xl">
            <input 
              type="text" 
              placeholder="Enter clue..."
              value={cueInput}
              onChange={(e) => setCueInput(e.target.value.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, ''))}
              className="bg-slate-900 text-white px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg outline-none w-24 sm:w-48 text-xs sm:text-sm"
              maxLength={20}
            />
            <select 
              value={numInput} 
              onChange={(e) => setNumInput(e.target.value ? Number(e.target.value) : '')}
              className="bg-slate-900 text-white px-1 py-1.5 sm:px-2 sm:py-2 rounded-lg outline-none text-xs sm:text-sm cursor-pointer"
            >
              <option value="" disabled>-</option>
              {[0,1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
              <option value={99}>∞</option>
            </select>
            <button 
              type="submit"
              disabled={
                cueInput.trim().length === 0 || 
                numInput === '' || 
                (numInput !== 99 && clueTargetCount > 0 && clueTargetCount !== numInput) || 
                (numInput === 99 && clueTargetCount === 0)
              }
              className="px-2 py-1.5 sm:px-4 sm:py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-xs sm:text-sm whitespace-nowrap"
            >
              Give Clue
            </button>
          </form>
        ) : currentPhase === 'spymaster' ? (
          <div className="px-4 py-2 bg-slate-800 text-slate-400 font-bold rounded-xl text-sm animate-pulse">
            {gameMode === 'classic' 
              ? 'Waiting for Spymaster...' 
              : `Waiting for Side ${currentTurn === 'red' ? 'A' : 'B'}...`}
          </div>
        ) : (
          <div className="flex items-center gap-4">
            {showSpymasterToggle && (
              <button
                onClick={onToggleSpymaster}
                className={`px-4 py-2 rounded-lg font-bold transition-all ${
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
