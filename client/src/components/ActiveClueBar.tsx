import { Check } from 'lucide-react';
import { cn } from '../utils';

interface ActiveClueBarProps {
  activeCue: string | null;
  activeCueNumber: number | null;
  successfulGuessesThisTurn: number;
  onEndTurn: () => void;
  canEndTurn: boolean;
}

export default function ActiveClueBar({
  activeCue,
  activeCueNumber,
  successfulGuessesThisTurn,
  onEndTurn,
  canEndTurn
}: ActiveClueBarProps) {
  if (!activeCue || activeCueNumber === null) return null;

  const isUnlimited = activeCueNumber === 99;
  const isBonus = !isUnlimited && successfulGuessesThisTurn === activeCueNumber;

  return (
    <div className="w-full max-w-3xl mx-auto mt-4 sm:mt-6 lg:mt-2 flex items-center justify-center gap-3 sm:gap-4 px-2 sm:px-4 animate-fade-in">
      <div className="flex-1 bg-gradient-to-r from-slate-100 to-white rounded-full py-2 sm:py-3 px-4 sm:px-6 flex items-center justify-between shadow-xl ring-1 ring-slate-200">
        {activeCue.startsWith('data:image') ? (
          <img src={activeCue} alt="Doodle Clue" className="h-10 sm:h-14 rounded-lg border border-slate-300 shadow-sm object-contain bg-white" />
        ) : (
          <span className="text-slate-900 font-black text-xl sm:text-3xl uppercase tracking-widest truncate">
            {activeCue}
          </span>
        )}
        
        {isBonus ? (
          <div className="flex items-center gap-2 bg-gradient-to-r from-blue-100 to-indigo-100 px-3 py-1 sm:px-4 sm:py-2 rounded-full border-2 border-blue-400 shadow-inner">
            <span className="text-blue-700 font-black text-sm sm:text-lg whitespace-nowrap drop-shadow-sm">
              {activeCueNumber}+1 BONUS
            </span>
          </div>
        ) : (
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xl sm:text-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0 ring-2 ring-white">
            {isUnlimited ? '∞' : activeCueNumber}
          </div>
        )}
      </div>

      <button
        onClick={onEndTurn}
        disabled={!canEndTurn}
        className={cn(
          "w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-lg transition-all flex-shrink-0 ring-2 ring-white/20",
          canEndTurn 
            ? "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/40 hover:from-emerald-300 hover:to-emerald-500 hover:scale-105 active:scale-95 cursor-pointer" 
            : "bg-slate-700 opacity-50 cursor-not-allowed"
        )}
      >
        <Check className="w-6 h-6 sm:w-8 sm:h-8 text-white font-bold" strokeWidth={4} />
      </button>
    </div>
  );
}
