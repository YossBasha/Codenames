import { useState } from 'react';
import { Check, X, Flag } from 'lucide-react';
import { cn } from '../utils';
import { useI18n } from '../context/I18nContext';

interface ActiveClueBarProps {
  activeCue: string | null;
  activeCueNumber: number | null;
  successfulGuessesThisTurn: number;
  onEndTurn: () => void;
  canEndTurn: boolean;
  onReportClue?: () => void;
}

export default function ActiveClueBar({
  activeCue,
  activeCueNumber,
  successfulGuessesThisTurn,
  onEndTurn,
  canEndTurn,
  onReportClue
}: ActiveClueBarProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const { t } = useI18n();

  if (!activeCue || activeCueNumber === null) return null;

  const isUnlimited = activeCueNumber === 99;
  const isBonus = !isUnlimited && successfulGuessesThisTurn === activeCueNumber;

  return (
    <>
      <div className="w-full shrink-0 max-w-3xl mx-auto mt-4 sm:mt-6 lg:mt-2 flex items-center justify-center gap-3 sm:gap-4 px-2 sm:px-4 animate-fade-in">
        <div className="flex-1 min-w-0 bg-gradient-to-r from-slate-100 to-white rounded-full py-2 sm:py-3 px-4 sm:px-6 flex items-center justify-between gap-2 shadow-xl ring-1 ring-slate-200">
          {activeCue.startsWith('data:image') ? (
            <img 
              src={activeCue} 
              alt={t('doodle_clue')}
              className="h-10 sm:h-14 rounded-lg border border-slate-300 shadow-sm object-contain bg-white cursor-pointer hover:scale-105 transition-transform" 
              onClick={() => setIsZoomed(true)}
              title={t('click_to_enlarge')}
            />
          ) : (
            <div className="flex-1 min-w-0 max-h-[60px] sm:max-h-[80px] overflow-y-auto overflow-x-hidden scrollbar-none pr-1 flex items-center">
              <span className={cn(
                "text-slate-900 font-black uppercase tracking-widest break-words whitespace-normal block w-full leading-tight",
                activeCue.length > 20 ? "text-sm sm:text-lg" : activeCue.length > 12 ? "text-base sm:text-2xl" : "text-xl sm:text-3xl"
              )}>
                {activeCue}
              </span>
            </div>
          )}
          
          {isBonus ? (
            <div className="flex items-center gap-2 bg-gradient-to-r from-blue-100 to-indigo-100 px-3 py-1 sm:px-4 sm:py-2 rounded-full border-2 border-blue-400 shadow-inner">
              <span className="text-blue-700 font-black text-sm sm:text-lg whitespace-nowrap drop-shadow-sm">
                {activeCueNumber} {t('bonus_plus_one')}
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

        {onReportClue && (
          <button
            onClick={onReportClue}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center transition-all group shadow-md shrink-0 cursor-pointer hover:border-red-400/50"
            title="Report Cheat"
          >
            <Flag className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-red-400 transition-colors" />
          </button>
        )}
      </div>

      {isZoomed && activeCue.startsWith('data:image') && (
        <div 
          className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setIsZoomed(false)}
        >
          <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center justify-center">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsZoomed(false); }}
              className="absolute -top-12 right-0 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
              title={t('close_btn')}
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <img 
              src={activeCue} 
              alt={t('doodle_clue_enlarged')}
              className="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl bg-white border-4 border-slate-700 cursor-default" 
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
