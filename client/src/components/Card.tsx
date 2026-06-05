import { useState, useEffect, useRef } from "react";
import type { Card as CardType } from "../../../shared/types";
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
  onClick: (id: number) => void;
}

export default function Card({ card, isSpymaster, disabled, playerTeam, gameMode = 'classic', isRTL = false, isClueTarget = false, isGivingClue = false, onClick }: CardProps) {
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

  useEffect(() => {
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
    red: "bg-red-500 text-white shadow-red-500/50",
    blue: "bg-blue-500 text-white shadow-blue-500/50",
    green: "bg-emerald-500 text-white shadow-emerald-500/50",
    neutral: "bg-stone-300 text-stone-800 shadow-stone-300/50",
    assassin: "bg-slate-900 text-white shadow-slate-900/50",
  };

  const hiddenClasses =
    "bg-slate-700/80 text-white border border-slate-600 hover:bg-slate-600/80";

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
      onMouseEnter={() => {
        if (!isDisabled) playCardHoverSfx();
      }}
      disabled={isDisabled}
      className={cn(
        "relative w-full aspect-[4/3] sm:aspect-[3/2] rounded-lg sm:rounded-xl text-[9px] xs:text-[11px] sm:text-sm lg:text-lg font-black tracking-tighter sm:tracking-tight shadow-md transition-all duration-300 transform overflow-hidden",
        isDisabled && !isRevealedForMe && !isGivingClue
          ? "cursor-default opacity-80"
          : isGivingClue && !isValidClueTarget
            ? "cursor-default opacity-80"
            : "hover:-translate-y-1 hover:shadow-xl cursor-pointer",
        hiddenClasses,
        card.revealed && isSpymaster && "opacity-50",
        isRevealedForMe && !card.revealed && "opacity-80",
        isClueTarget && "ring-4 ring-yellow-400 ring-offset-2 ring-offset-slate-900 scale-105 z-10",
        justRevealed && "animate-reveal-pop"
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Background Revealed Layer (Ink Bleed) */}
      {showColor && (
        <div 
          className={cn(
            "absolute inset-0 flex items-center justify-center w-full h-full",
            (!isSpymaster || justRevealed) && "animate-ink-bleed",
            colorClasses[typeToDisplay]
          )}
        />
      )}

      {/* Base Word */}
      <div className="relative z-10 flex items-center justify-center h-full w-full p-1 sm:p-2 text-center break-words leading-none sm:leading-tight">
        {card.word}
      </div>

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
