import type { Player, Team } from '../../../shared/types';
import { cn } from '../utils';

interface TeamColumnProps {
  team: Team;
  score: number;
  operatives: Player[];
  spymasters: Player[];
  gameMode?: 'classic' | 'duet';
}

export default function TeamColumn({ team, score, operatives, spymasters, gameMode = 'classic' }: TeamColumnProps) {
  const isRed = team === 'red';
  
  if (gameMode === 'duet') {
    const allPlayers = [...operatives, ...spymasters];
    const isSideA = isRed;
    return (
      <div className="flex flex-col gap-2 flex-1 lg:flex-none lg:w-48 xl:w-56 lg:flex-shrink-0">
        <div className={cn(
          "rounded-xl lg:rounded-2xl p-4 flex flex-col items-center shadow-lg",
          isSideA ? "bg-lime-500/20 border-2 border-lime-500/50" : "bg-green-500/20 border-2 border-green-500/50"
        )}>
          <h3 className={cn("text-sm lg:text-xl font-black tracking-widest mb-4", isSideA ? "text-lime-400" : "text-green-400")}>
            {isSideA ? "SIDE A" : "SIDE B"}
          </h3>
          <div className="flex flex-col gap-3 w-full">
            {allPlayers.length === 0 ? (
              <span className="text-slate-500 text-sm italic text-center">Empty</span>
            ) : (
              allPlayers.map(p => (
                <div key={p.id} className={cn(
                  "text-white text-sm lg:text-base font-bold bg-black/40 px-4 py-2 rounded-xl text-center w-full whitespace-nowrap overflow-hidden text-ellipsis border border-white/10 shadow-md transition-opacity",
                  p.connected === false && "opacity-50 grayscale"
                )}>
                  {p.name} {p.connected === false && "(Offline)"}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 flex-1 lg:flex-none lg:w-48 xl:w-56 lg:flex-shrink-0">
      {/* OPERATIVES BOX */}
      <div className={cn(
        "rounded-xl lg:rounded-2xl p-2 lg:p-4 flex flex-col items-center",
        isRed ? "bg-red-500/20 border-2 border-red-500/50" : "bg-blue-500/20 border-2 border-blue-500/50"
      )}>
        <h3 className={cn("text-[9px] lg:text-sm font-black tracking-widest mb-1 lg:mb-2 leading-none", isRed ? "text-red-400" : "text-blue-400")}>
          OPERATIVES
        </h3>
        <div className="flex flex-wrap gap-2 justify-center">
          {operatives.length === 0 ? (
            <span className="text-slate-500 text-xs italic">Empty</span>
          ) : (
            operatives.map(p => (
              <div key={p.id} className={cn(
                "text-white text-[10px] lg:text-sm font-bold bg-black/30 px-2 lg:px-3 py-0.5 lg:py-1 rounded-full whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px] lg:max-w-none transition-opacity",
                p.connected === false && "opacity-50 grayscale"
              )}>
                {p.name} {p.connected === false && "(Offline)"}
              </div>
            ))
          )}
        </div>
      </div>

      {/* SCORE BOX */}
      <div className="flex justify-center items-center py-1 lg:py-2">
        <div className={cn(
          "text-4xl lg:text-6xl font-black drop-shadow-lg",
          isRed ? "text-red-500" : "text-blue-500"
        )}>
          {score}
        </div>
      </div>

      {/* SPYMASTERS BOX */}
      <div className={cn(
        "rounded-xl lg:rounded-2xl p-2 lg:p-4 flex flex-col items-center",
        isRed ? "bg-red-500/20 border-2 border-red-500/50" : "bg-blue-500/20 border-2 border-blue-500/50"
      )}>
        <h3 className={cn("text-[9px] lg:text-sm font-black tracking-widest mb-1 lg:mb-2 leading-none", isRed ? "text-red-400" : "text-blue-400")}>
          SPYMASTERS
        </h3>
        <div className="flex flex-wrap gap-2 justify-center">
          {spymasters.length === 0 ? (
            <span className="text-slate-500 text-xs italic">Empty</span>
          ) : (
            spymasters.map(p => (
              <div key={p.id} className={cn(
                "text-white text-[10px] lg:text-sm font-bold bg-black/30 px-2 lg:px-3 py-0.5 lg:py-1 rounded-full whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px] lg:max-w-none transition-opacity",
                p.connected === false && "opacity-50 grayscale"
              )}>
                {p.name} {p.connected === false && "(Offline)"}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
