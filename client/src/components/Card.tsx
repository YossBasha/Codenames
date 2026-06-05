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

  const isEmoji = /\p{Extended_Pictographic}/u.test(card.word);

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!isDisabled) {
            playCardSelectSfx();
            onClick(card.id);
          }
        }
      }}
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
      aria-disabled={isDisabled}
      className={cn(
        "relative w-full aspect-[4/3] sm:aspect-[3/2] rounded-lg sm:rounded-xl font-black transition-all duration-300 transform overflow-hidden",
        isEmoji ? "text-4xl sm:text-5xl lg:text-7xl" : "text-[9px] xs:text-[11px] sm:text-sm lg:text-lg tracking-tighter sm:tracking-tight",
        isDisabled && !isRevealedForMe && !isGivingClue
          ? "cursor-default opacity-80"
          : isGivingClue && !isValidClueTarget
            ? "cursor-default opacity-80"
            : "hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-xl cursor-pointer",
        hiddenClasses,
        card.revealed && isSpymaster && "opacity-50",
        showColor && shadowClasses[typeToDisplay],
        (isClueTarget || highlightedBy.length > 0) && "scale-[1.02] z-10",
        justRevealed && !['green', 'red', 'blue'].includes(typeToDisplay) && "animate-reveal-pop",
        justRevealed && ['green', 'red', 'blue'].includes(typeToDisplay) && "animate-card-flip"
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Ring Overlay (so it sits above the color background) */}
      <div className={cn(
        "absolute inset-0 rounded-lg sm:rounded-xl pointer-events-none z-20",
        isClueTarget && "ring-2 sm:ring-4 ring-inset ring-yellow-400 shadow-[inset_0_0_15px_rgba(250,204,21,0.5),0_0_15px_rgba(250,204,21,0.5)]",
        highlightedBy.length > 0 && "ring-2 sm:ring-4 ring-inset ring-white shadow-[inset_0_0_15px_rgba(255,255,255,0.5),0_0_15px_rgba(255,255,255,0.5)]"
      )} />

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

      {/* Base Word - only hide text for globally revealed green/red/blue cards (correct guesses) */}
      {!card.revealed || !['green', 'red', 'blue'].includes(typeToDisplay) ? (
        <div className="relative z-10 flex items-center justify-center h-full w-full p-1 sm:p-2 text-center break-words leading-none sm:leading-tight">
          {card.word}
        </div>
      ) : null}

      {/* Highlight Indicators & Confirm Button - positioned at bottom-left to avoid hiding card text */}
      {highlightedBy.length > 0 && (
        <div className="absolute bottom-0.5 left-0.5 sm:bottom-1.5 sm:left-1.5 flex items-end gap-0.5 sm:gap-1 z-30 pointer-events-none">
          {highlightedBy.map((p, i) => (
             <img key={i} src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name)}&backgroundColor=${p.team === 'red' ? 'ef4444' : '3b82f6'}`} alt={p.name} title={p.name} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-white/80 drop-shadow-md" />
          ))}
          {highlightedBy.some(p => p.id === currentPlayerId) && onGuess && !isDisabled && (
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  e.preventDefault();
                  playCardSelectSfx();
                  onGuess(card.id);
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                playCardSelectSfx();
                onGuess(card.id);
              }}
              className="pointer-events-auto ml-0.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-orange-500 border-2 border-orange-300 shadow-[0_0_10px_rgba(249,115,22,0.5)] flex items-center justify-center hover:scale-110 active:scale-95 transition-transform cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sm:w-4 sm:h-4"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
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
      

    </div>
  );
}
