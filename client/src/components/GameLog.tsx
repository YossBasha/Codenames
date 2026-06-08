import { useEffect, useRef } from 'react';
import type { LogEntry } from '../../../shared/types';
import { cn } from '../utils';
import { useI18n } from '../context/I18nContext';

interface GameLogProps {
  logs: LogEntry[];
  gameMode?: 'classic' | 'duet';
}

export default function GameLog({ logs, gameMode = 'classic' }: GameLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col bg-black/40 border border-slate-700/50 rounded-2xl overflow-hidden flex-1 relative w-full min-h-[150px]">
      <div className="bg-black/40 p-2 text-center text-xs font-black tracking-widest text-slate-500 absolute top-0 left-0 right-0 z-10 shadow-md h-8">
        {t('game_log')}
      </div>
      <div className="absolute top-8 left-0 right-0 bottom-0 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-thin scrollbar-thumb-slate-700">
        {logs.length === 0 ? (
          <div className="text-slate-500 text-sm text-center italic mt-auto mb-auto">
            {t('no_moves_yet')}
          </div>
        ) : (
          logs.map((log) => {
            if (log.type === 'cue') {
              const isRed = log.team === 'red';
              const isDuet = gameMode === 'duet';
              
              let bgClass = isRed ? "bg-red-900/80 border border-red-700" : "bg-blue-900/80 border border-blue-700";
              let badgeBg = isRed ? "bg-red-500" : "bg-blue-500";
              
              if (isDuet) {
                bgClass = isRed ? "bg-lime-900/80 border border-lime-700" : "bg-green-900/80 border border-green-700";
                badgeBg = isRed ? "bg-lime-500" : "bg-green-500";
              }

              return (
                <div 
                  key={log.id} 
                  className={cn(
                    "flex flex-col rounded-xl p-3 shadow-lg relative animate-in fade-in slide-in-from-bottom-2",
                    bgClass
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <img src={log.player.avatarUrl} alt="avatar" className="w-5 h-5 rounded-full bg-black/20" />
                    <span className="text-white/80 font-bold text-[10px] tracking-wider uppercase">
                      {log.player.name}
                    </span>
                  </div>
                  
                  <div className="bg-white rounded-lg p-2 text-center shadow-inner">
                    {log.cueWord.startsWith('data:image') ? (
                      <img src={log.cueWord} alt="Clue" className="w-full max-h-24 object-contain rounded-md" />
                    ) : (
                      <span className="text-slate-900 font-black text-sm tracking-widest uppercase break-all">
                        {log.cueWord}
                      </span>
                    )}
                  </div>
                  
                  <div className={cn(
                    "absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shadow-md border-2 border-slate-900 text-white",
                    badgeBg
                  )}>
                    {log.cueNumber === 99 ? '∞' : log.cueNumber}
                  </div>
                </div>
              );
            } else if (log.type === 'guess') {
              let bgColor = "bg-slate-700";
              let textColor = "text-white";
              
              if (log.revealedColor === 'red') {
                bgColor = "bg-red-500";
              } else if (log.revealedColor === 'blue') {
                bgColor = "bg-blue-500";
              } else if (log.revealedColor === 'assassin') {
                bgColor = "bg-slate-900";
                textColor = "text-red-500";
              } else if (log.revealedColor === 'green') {
                bgColor = "bg-green-500";
              } else {
                bgColor = "bg-stone-400";
                textColor = "text-slate-900";
              }

              return (
                <div key={log.id} className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 pl-2">
                  <div className="flex flex-col items-center">
                    <img src={log.player.avatarUrl} alt="avatar" className="w-6 h-6 rounded-full bg-black/20 shadow-sm" />
                    <span className="text-slate-400 font-bold text-[9px] mt-0.5 truncate w-12 text-center">
                      {log.player.name}
                    </span>
                  </div>
                  
                  <div className={cn("px-3 py-1.5 rounded-full font-black text-xs tracking-wider shadow-md border border-white/10 uppercase", bgColor, textColor)}>
                    {log.cardWord}
                  </div>
                </div>
              );
            }
            return null;
          })
        )}
        <div ref={bottomRef} className="h-1" />
      </div>
    </div>
  );
}
