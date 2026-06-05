import { useState, useLayoutEffect, useRef } from "react";
import type { Card as CardType, Player } from "../../../shared/types";
import { cn } from "../utils";
import { playCardHoverSfx, playCardSelectSfx } from "../utils/sfx";

interface CardProps {
  card: CardType;
  isSpymaster: boolean;
  disabled?: boolean;
  playerTeam?: string;
  gameMode?: 'classic' | 'duet';
  isRTL?: boolean;
  isClueTarget?: boolean;
  isGivingClue?: boolean;
  highlightedBy?: Player[];
  currentPlayerId?: string;
  onClick: (id: number) => void;
  onContextMenu?: (e: React.MouseEvent, id: number) => void;
  onGuess?: (id: number) => void;
}

export default function Card({ card, isSpymaster, disabled, playerTeam, gameMode = 'classic', isRTL = false, isClueTarget = false, isGivingClue = false, highlightedBy = [], currentPlayerId, onClick, onContextMenu, onGuess }: CardProps) {
  let isRevealedForMe = card.revealed;
  if (gameMode === 'duet' && !card.revealed) {
    if (playerTeam === 'red' && card.revealedByA) {
      isRevealedForMe = true;
    }
    if (playerTeam === 'blue' && card.revealedByB) {
      isRevealedForMe = true;
    }
  }

  const [justRevealed, setJustRevealed] = useState(false);
  const wasRevealedForMe = useRef(isRevealedForMe);

  useLayoutEffect(() => {
    if (!wasRevealedForMe.current && isRevealedForMe) {
      setJustRevealed(true);
      const timer = setTimeout(() => setJustRevealed(false), 600);
      return () => clearTimeout(timer);
    }
    wasRevealedForMe.current = isRevealedForMe;
  }, [isRevealedForMe]);

  const showColor = isRevealedForMe || isSpymaster;

  let typeToDisplay = card.type;
  if (gameMode === 'duet' && isSpymaster && !card.revealed) {
    // Spymasters see their team's key (A = red, B = blue)
    typeToDisplay = playerTeam === 'blue' ? card.duetTypeB! : card.duetTypeA!;
  }
  
  if (gameMode === 'duet' && card.revealed) {
    // Use whatever the server set card.type to dynamically upon reveal
    typeToDisplay = card.type;
  }

  const colorClasses = {
    red: "bg-gradient-to-br from-red-500 to-rose-700 text-white",
    blue: "bg-gradient-to-br from-blue-500 to-indigo-700 text-white",
    green: "bg-gradient-to-br from-emerald-400 to-teal-600 text-white",
    neutral: "bg-gradient-to-br from-stone-200 to-stone-400 text-stone-900",
    assassin: "bg-gradient-to-br from-slate-800 to-slate-950 text-white",
  };

  const shadowClasses = {
    red: "shadow-lg shadow-red-600/40 border-red-500/50 ring-1 ring-red-400/20",
    blue: "shadow-lg shadow-blue-600/40 border-blue-500/50 ring-1 ring-blue-400/20",
    green: "shadow-lg shadow-emerald-600/40 border-emerald-500/50 ring-1 ring-emerald-400/20",
    neutral: "shadow-lg shadow-stone-400/40 border-stone-300/50 ring-1 ring-white/40",
    assassin: "shadow-lg shadow-slate-900/50 border-slate-700/50 ring-1 ring-slate-700/30",
  };

  const hiddenClasses =
    "bg-gradient-to-br from-slate-700 to-slate-800 text-white border border-slate-600/50 shadow-[0_4px_12px_rgb(0_0_0/0.3)] hover:from-slate-600 hover:to-slate-700";

  let isValidClueTarget = false;
  if (isGivingClue) {
    if (gameMode === 'classic') {
      isValidClueTarget = card.type === playerTeam && !card.revealed;
    } else {
      if (playerTeam === 'red') {
        isValidClueTarget = card.duetTypeA === 'green' && !card.revealedByB;
      } else if (playerTeam === 'blue') {
        isValidClueTarget = card.duetTypeB === 'green' && !card.revealedByA;
      }
    }
  }

  let isDisabled = disabled;
  if (isGivingClue) {
    isDisabled = !isValidClueTarget;
  } else {
    isDisabled = isRevealedForMe || (isSpymaster && gameMode !== 'duet') || disabled;
  }

  return (
    <button
      onClick={() => {
        if (!isDisabled) {
          playCardSelectSfx();
          onClick(card.id);
        }
      }}
      onContextMenu={(e) => {
        if (onContextMenu) onContextMenu(e, card.id);
      }}
      onMouseEnter={() => {
        if (!isDisabled) playCardHoverSfx();
      }}
      disabled={isDisabled}
      className={cn(
        "relative w-full aspect-[4/3] sm:aspect-[3/2] rounded-lg sm:rounded-xl text-[9px] xs:text-[11px] sm:text-sm lg:text-lg font-black tracking-tighter sm:tracking-tight transition-all duration-300 transform overflow-hidden",
        isDisabled && !isRevealedForMe && !isGivingClue
          ? "cursor-default opacity-80"
          : isGivingClue && !isValidClueTarget
            ? "cursor-default opacity-80"
            : "hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-xl cursor-pointer",
        hiddenClasses,
        card.revealed && isSpymaster && "opacity-50",
        showColor && shadowClasses[typeToDisplay],
        isClueTarget && "ring-4 ring-yellow-400 ring-offset-2 ring-offset-slate-900 scale-105 z-10",
        highlightedBy.length > 0 && "ring-4 ring-white ring-offset-2 ring-offset-slate-900 scale-[1.02] z-10 shadow-[0_0_15px_rgba(255,255,255,0.5)]",
        justRevealed && !['green', 'red', 'blue'].includes(typeToDisplay) && "animate-reveal-pop",
        justRevealed && ['green', 'red', 'blue'].includes(typeToDisplay) && "animate-card-flip"
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Background Revealed Layer (Ink Bleed) */}
      {showColor && (
        <div 
          className={cn(
            "absolute inset-0 flex items-center justify-center w-full h-full",
            !isSpymaster && "animate-ink-bleed",
            colorClasses[typeToDisplay]
          )}
        />
      )}

      {/* Base Word */}
      {!isRevealedForMe || !['green', 'red', 'blue'].includes(typeToDisplay) ? (
        <div className="relative z-10 flex items-center justify-center h-full w-full p-1 sm:p-2 text-center break-words leading-none sm:leading-tight">
          {card.word}
        </div>
      ) : null}

      {/* Highlight Indicators & Confirm Button */}
      {highlightedBy.length > 0 && (
        <div className="absolute top-1 left-1 sm:top-2 sm:left-2 flex gap-1 z-30 pointer-events-none">
          {highlightedBy.map((p, i) => (
             <div key={i} className="flex flex-col items-center drop-shadow-md">
               <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name)}&backgroundColor=${p.team === 'red' ? 'ef4444' : '3b82f6'}`} alt={p.name} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white/80" />
               <div className="bg-slate-900/80 text-white text-[6px] sm:text-[8px] font-bold px-1.5 rounded-full mt-0.5 truncate max-w-[40px] sm:max-w-[50px]">{p.name}</div>
             </div>
          ))}
          {highlightedBy.some(p => p.id === currentPlayerId) && onGuess && !isDisabled && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                playCardSelectSfx();
                onGuess(card.id);
              }}
              className="pointer-events-auto ml-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-orange-500 border-2 border-orange-300 shadow-[0_0_10px_rgba(249,115,22,0.5)] flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sm:w-5 sm:h-5"><path d="M8 13v-8.5a1.5 1.5 0 0 1 3 0v7.5"/><path d="M11 11.5v-2a1.5 1.5 0 1 1 3 0v2.5"/><path d="M14 10.5v-1.5a1.5 1.5 0 1 1 3 0v4"/><path d="M17 11.5v-1.5a1.5 1.5 0 1 1 3 0v4.5a6 6 0 0 1-6 6h-2h.208a6 6 0 0 1-5.012-2.7L7 19c-1.3-2.3-1.4-2.81-1.76-4.57a1.503 1.503 0 0 1 2.87-1.12l1.89 5.69"/></svg>
            </button>
          )}
        </div>
      )}

      {/* Duet Timer Tokens */}
      {gameMode === 'duet' && card.revealedByA && !card.revealed && (
        <div className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500 border-2 border-white shadow-md text-[8px] sm:text-[10px] text-white z-20 font-bold" title="Side A guessed incorrectly">
          A
        </div>
      )}
      {gameMode === 'duet' && card.revealedByB && !card.revealed && (
        <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500 border-2 border-white shadow-md text-[8px] sm:text-[10px] text-white z-20 font-bold" title="Side B guessed incorrectly">
          B
        </div>
      )}

      {/* Glow Layer (Always animating, toggles opacity) */}
      {isGivingClue && isValidClueTarget && (
        <div 
          className={cn(
            "absolute inset-0 rounded-lg sm:rounded-xl ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-900 animate-pulse pointer-events-none transition-opacity duration-200 z-20",
            isClueTarget ? "opacity-0" : "opacity-100"
          )}
        />
      )}

      {/* Spymaster Overlay */}
      {showColor && !card.revealed && isSpymaster && (
        <div className="absolute inset-0 bg-white/20 z-10" />
      )}
      
      {/* Tracking Indicators for Asymmetric Duet State */}
      {gameMode === 'duet' && !card.revealed && (
        <div className="absolute bottom-1 right-1 sm:bottom-1.5 sm:right-1.5 flex gap-1 z-20">
          {card.revealedByA && <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-red-500 border border-slate-900 shadow-md"></div>}
          {card.revealedByB && <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-blue-500 border border-slate-900 shadow-md"></div>}
        </div>
      )}
    </button>
  );
}
