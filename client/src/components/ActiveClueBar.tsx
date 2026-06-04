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
    <div className="w-full max-w-3xl mx-auto mt-4 sm:mt-6 lg:mt-2 flex items-center justify-center gap-3 sm:gap-4 px-2 sm:px-4">
      <div className="flex-1 bg-white rounded-full py-2 sm:py-3 px-4 sm:px-6 flex items-center justify-between shadow-[0_0_20px_rgba(0,0,0,0.3)]">
        <span className="text-slate-900 font-black text-xl sm:text-3xl uppercase tracking-widest truncate">
          {activeCue}
        </span>
        
        {isBonus ? (
          <div className="flex items-center gap-2 bg-blue-100 px-3 py-1 sm:px-4 sm:py-2 rounded-full border-2 border-blue-500 shadow-inner">
            <span className="text-blue-600 font-black text-sm sm:text-lg whitespace-nowrap">
              {activeCueNumber}+1 BONUS
            </span>
          </div>
        ) : (
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-500 text-white font-black text-xl sm:text-2xl flex items-center justify-center shadow-md flex-shrink-0">
            {isUnlimited ? '∞' : activeCueNumber}
          </div>
        )}
      </div>

      <button
        onClick={onEndTurn}
        disabled={!canEndTurn}
        className={cn(
          "w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.4)] transition-all flex-shrink-0",
          canEndTurn 
            ? "bg-emerald-500 hover:bg-emerald-400 hover:scale-105 active:scale-95 cursor-pointer" 
            : "bg-slate-700 opacity-50 cursor-not-allowed"
        )}
      >
        <Check className="w-6 h-6 sm:w-8 sm:h-8 text-white font-bold" strokeWidth={4} />
      </button>
    </div>
  );
}
