import type { Player, Team } from '../../../shared/types';
import { cn } from '../utils';
import { useI18n } from '../context/I18nContext';

interface TeamColumnProps {
  team: Team;
  score: number;
  operatives: Player[];
  spymasters: Player[];
  gameMode?: 'classic' | 'duet';
  className?: string;
}

export default function TeamColumn({ team, score, operatives, spymasters, gameMode = 'classic', className }: TeamColumnProps) {
  const isRed = team === 'red';
  const { t } = useI18n();
  
  if (gameMode === 'duet') {
    const allPlayers = [...operatives, ...spymasters];
    const isSideA = isRed;
    return (
      <div className={cn("flex flex-col gap-2 flex-1 lg:flex-none lg:w-48 xl:w-56 lg:flex-shrink-0", className)}>
        <div className={cn(
          "rounded-xl lg:rounded-2xl p-4 flex flex-col items-center shadow-xl ring-1",
          isSideA ? "bg-gradient-to-b from-lime-500/20 to-lime-500/5 ring-lime-500/30" : "bg-gradient-to-b from-green-500/20 to-green-500/5 ring-green-500/30"
        )}>
          <h3 className={cn("text-sm lg:text-xl font-black tracking-widest mb-4", isSideA ? "text-lime-400" : "text-green-400")}>
            {isSideA ? t('side_a') : t('side_b')}
          </h3>
          <div className="flex flex-col gap-3 w-full">
            {allPlayers.length === 0 ? (
              <span className="text-slate-500 text-sm italic text-center">{t('empty')}</span>
            ) : (
              allPlayers.map(p => (
                <div key={p.id} className={cn(
                  "text-white text-xs lg:text-base font-bold bg-black/40 px-2 py-1 lg:px-4 lg:py-2 rounded-xl text-center w-full whitespace-nowrap overflow-hidden text-ellipsis border-t border-white/10 shadow-lg transition-opacity",
                  p.connected === false && "opacity-50 grayscale"
                )}>
                  {p.name} {p.connected === false && t('offline')}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2 flex-1 lg:flex-none lg:w-48 xl:w-56 lg:flex-shrink-0", className)}>
      {/* OPERATIVES BOX */}
      <div className={cn(
        "rounded-xl lg:rounded-2xl p-2 lg:p-4 flex flex-col items-center shadow-lg ring-1",
        isRed ? "bg-gradient-to-b from-red-500/20 to-red-500/5 ring-red-500/30 shadow-red-500/10" : "bg-gradient-to-b from-blue-500/20 to-blue-500/5 ring-blue-500/30 shadow-blue-500/10"
      )}>
        <h3 className={cn("text-[9px] lg:text-sm font-black tracking-widest mb-1 lg:mb-2 leading-none", isRed ? "text-red-400" : "text-blue-400")}>
          {t('operatives_role')}
        </h3>
        <div className="flex flex-wrap gap-2 justify-center">
          {operatives.length === 0 ? (
            <span className="text-slate-500 text-xs italic">{t('empty')}</span>
          ) : (
            operatives.map(p => (
              <div key={p.id} className={cn(
                "text-white text-[10px] lg:text-sm font-bold bg-black/30 px-2 lg:px-3 py-0.5 lg:py-1 rounded-full whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px] lg:max-w-none transition-opacity",
                p.connected === false && "opacity-50 grayscale"
              )}>
                {p.name} {p.connected === false && t('offline')}
              </div>
            ))
          )}
        </div>
      </div>

      {/* SCORE BOX */}
      <div className="flex justify-center items-center py-2 lg:py-4">
        <div className={cn(
          "text-5xl lg:text-7xl font-black drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]",
          isRed ? "text-transparent bg-clip-text bg-gradient-to-br from-red-400 to-red-600 drop-shadow-[0_0_20px_rgba(239,68,68,0.3)]" : "text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-blue-600 drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]"
        )}>
          {score}
        </div>
      </div>

      {/* SPYMASTERS BOX */}
      <div className={cn(
        "rounded-xl lg:rounded-2xl p-2 lg:p-4 flex flex-col items-center shadow-lg ring-1",
        isRed ? "bg-gradient-to-b from-red-500/20 to-red-500/5 ring-red-500/30 shadow-red-500/10" : "bg-gradient-to-b from-blue-500/20 to-blue-500/5 ring-blue-500/30 shadow-blue-500/10"
      )}>
        <h3 className={cn("text-[9px] lg:text-sm font-black tracking-widest mb-1 lg:mb-2 leading-none", isRed ? "text-red-400" : "text-blue-400")}>
          {t('spymasters_role')}
        </h3>
        <div className="flex flex-wrap gap-2 justify-center">
          {spymasters.length === 0 ? (
            <span className="text-slate-500 text-xs italic">{t('empty')}</span>
          ) : (
            spymasters.map(p => (
              <div key={p.id} className={cn(
                "text-white text-[10px] lg:text-sm font-bold bg-black/30 px-2 lg:px-3 py-0.5 lg:py-1 rounded-full whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px] lg:max-w-none transition-opacity",
                p.connected === false && "opacity-50 grayscale"
              )}>
                {p.name} {p.connected === false && t('offline')}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
