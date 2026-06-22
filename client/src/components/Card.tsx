import { useState, useLayoutEffect, useRef, memo } from "react";
import type { Card as CardType, Player } from "../../../shared/types";
import { cn } from "../utils";
import { playCardHoverSfx, playCardSelectSfx, playNimnimChompSfx } from "../utils/sfx";
import { Lock, CloudFog } from "lucide-react";

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
  activeModifier?: string | null;
  currentPhase?: 'spymaster' | 'operative';
  scrambleDx?: number;
  scrambleDy?: number;
  isGuesser?: boolean;
  gachaHighlight?: boolean;
  d20FreeReveal?: boolean;
  isScramblePending?: boolean;
  isPoltergeistInverted?: boolean;
  isSwipedHover?: boolean;
  isTouchMode?: boolean;
  isEaten?: boolean;
}

function Card({ card, isSpymaster, disabled, playerTeam, gameMode = 'classic', isRTL = false, isClueTarget = false, isGivingClue = false, highlightedBy = [], currentPlayerId, onClick, onContextMenu, onGuess, activeModifier, currentPhase, scrambleDx, scrambleDy, isGuesser = false, gachaHighlight = false, d20FreeReveal = false, isScramblePending = false, isPoltergeistInverted = false, isSwipedHover = false, isTouchMode = false, isEaten = false }: CardProps) {
  const [eatenAnimState, setEatenAnimState] = useState<'none' | 'waiting' | 'chomping' | 'eaten' | 'spitting'>('none');
  const eatenTimersRef = useRef<number[]>([]);

  useLayoutEffect(() => {
    
    if (isEaten && eatenAnimState === 'none') {
      setEatenAnimState('waiting');
      const timer1 = setTimeout(() => {
        setEatenAnimState('chomping');
        playNimnimChompSfx();
      }, 3500) as unknown as number;
      
      const timer2 = setTimeout(() => {
        setEatenAnimState('eaten');
      }, 6500) as unknown as number;
      
      eatenTimersRef.current.push(timer1, timer2);
    } else if (!isEaten && eatenAnimState === 'eaten') {
      setEatenAnimState('spitting');
      const timer = setTimeout(() => {
        setEatenAnimState('none');
      }, 600) as unknown as number;
      
      eatenTimersRef.current.push(timer);
    } else if (isEaten && eatenAnimState !== 'waiting' && eatenAnimState !== 'chomping' && eatenAnimState !== 'eaten') {
      setEatenAnimState('eaten');
    } else if (!isEaten && eatenAnimState !== 'spitting' && eatenAnimState !== 'none') {
      setEatenAnimState('none');
    }
    
    // We intentionally don't clear timeouts in the cleanup if they are for the current sequence, 
    // but we can clear them on unmount.
    return () => {
      // Only clean up on unmount or if we need to interrupt (which we don't usually do)
    };
  }, [isEaten, eatenAnimState, card.id]);

  useLayoutEffect(() => {
    return () => {
      // Clear all timers on unmount
      eatenTimersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);


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

  if (activeModifier === 'colorblind' && gameMode === 'classic' && isSpymaster && !card.revealed) {
    if (typeToDisplay === 'red') typeToDisplay = 'blue';
    else if (typeToDisplay === 'blue') typeToDisplay = 'red';
  }

  const physicalColors = {
    red: { outer: "bg-[#fb923c]", top: "bg-[#ef4444]", bottom: "bg-[#7f1d1d]", border: "border-[#7f1d1d]", text: "text-white" },
    blue: { outer: "bg-[#38bdf8]", top: "bg-[#0ea5e9]", bottom: "bg-[#1e3a8a]", border: "border-[#1e3a8a]", text: "text-white" },
    green: { outer: "bg-[#bef264]", top: "bg-[#84cc16]", bottom: "bg-[#14532d]", border: "border-[#14532d]", text: "text-white" },
    neutral: { outer: "bg-[#e5c09e]", top: "bg-[#f3dfca]", bottom: "bg-[#967353]", border: "border-[#967353]", text: "text-white" },
    assassin: { outer: "bg-[#94a3b8]", top: "bg-[#475569]", bottom: "bg-[#0f172a]", border: "border-[#0f172a]", text: "text-white" },
  };

  const hiddenStyle = {
    outer: "bg-slate-700",
    top: "bg-slate-800",
    bottom: "bg-slate-900",
    border: "border-slate-600",
    text: "text-white"
  };

  let isValidClueTarget = false;
  if (isGivingClue) {
    const isSensoryFaded = activeModifier === 'sensory-deprivation' && currentPhase === 'spymaster' && !isSpymaster;
    if (isSensoryFaded) {
      if (gameMode === 'classic') {
        isValidClueTarget = !card.revealed;
      } else {
        if (playerTeam === 'red') {
          isValidClueTarget = !card.revealedByB;
        } else if (playerTeam === 'blue') {
          isValidClueTarget = !card.revealedByA;
        }
      }
    } else {
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
  }

  let isDisabled = disabled;
  if (isGivingClue) {
    isDisabled = !isValidClueTarget;
  } else {
    isDisabled = isRevealedForMe || (isSpymaster && gameMode !== 'duet') || disabled;
  }

  if (d20FreeReveal && isSpymaster && !isRevealedForMe) {
    const isOwnTeam = gameMode === 'duet' ? (typeToDisplay === 'green') : (typeToDisplay === playerTeam);
    if (isOwnTeam) {
      isDisabled = false;
    }
  }

  if (card.shieldedTurns && card.shieldedTurns > 0) {
    isDisabled = true;
  }

  const isEmoji = /\p{Extended_Pictographic}/u.test(card.word);

  if (eatenAnimState === 'eaten') {
    return (
      <div 
        className="w-full aspect-[4/3] sm:aspect-[3/2] max-h-[calc((100vh_-_220px)_/_5)] sm:max-h-[calc((100vh_-_340px)_/_5)] rounded-lg sm:rounded-xl bg-slate-900/5 border border-dashed border-slate-700/20 flex items-center justify-center opacity-25 pointer-events-none"
      />
    );
  }

  return (
    <div
      data-card-id={card.id}
      style={
        (scrambleDx !== undefined || scrambleDy !== undefined) && activeModifier === 'earthquake'
          ? {
              "--scramble-dx": `${(scrambleDx ?? 0) * 105}%`,
              "--scramble-dy": `${(scrambleDy ?? 0) * 105}%`,
              // Per-card variety: use card.id to seed pseudo-random rotation/lift values
              "--eq-lift":  `${48 + (card.id * 17 % 40)}px`,
              "--eq-rot0":  `${((card.id * 7)  % 11) - 5}deg`,
              "--eq-rot1":  `${((card.id * 13) % 22) - 11}deg`,
              "--eq-rot2":  `${((card.id * 11) % 14) - 7}deg`,
              "--eq-rot3":  `${((card.id * 5)  % 8)  - 4}deg`,
              animationDelay: `${(card.id * 47) % 280}ms`,
              ...(isScramblePending ? { transform: `translate(var(--scramble-dx, 0), var(--scramble-dy, 0))` } : {})
            } as React.CSSProperties
          : undefined
      }
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
        e.preventDefault();
        if (!isDisabled && onContextMenu) onContextMenu(e, card.id);
      }}
      onMouseEnter={() => {
        if (!isDisabled) playCardHoverSfx();
      }}
      aria-disabled={isDisabled}
      className={cn(
        "group relative w-full aspect-[4/3] sm:aspect-[3/2] max-h-[calc((100vh_-_220px)_/_5)] sm:max-h-[calc((100vh_-_340px)_/_5)] rounded-lg sm:rounded-xl font-black transition-all duration-300 transform",
        !(scrambleDx !== undefined || scrambleDy !== undefined) && "overflow-hidden",
        isEmoji ? "text-4xl sm:text-5xl lg:text-7xl" : "text-[9px] xs:text-[11px] sm:text-sm lg:text-lg tracking-tighter sm:tracking-tight",
        isDisabled && !isRevealedForMe && !isGivingClue && !d20FreeReveal
          ? "cursor-default opacity-80"
          : isGivingClue && !isValidClueTarget
            ? "cursor-default opacity-80"
            : "hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-xl cursor-pointer",
        card.revealed && isSpymaster && "opacity-50",
        (isClueTarget || highlightedBy.length > 0 || (d20FreeReveal && !isDisabled)) && "scale-[1.02] z-10",
        gachaHighlight && "z-40",
        justRevealed && !['green', 'red', 'blue'].includes(typeToDisplay) && "animate-reveal-pop",
        justRevealed && ['green', 'red', 'blue'].includes(typeToDisplay) && "animate-card-flip",
        !isScramblePending && (scrambleDx !== undefined || scrambleDy !== undefined) && activeModifier === 'earthquake' && "animate-earthquake",
        eatenAnimState === 'chomping' && "animate-chomp z-50 pointer-events-none",
        eatenAnimState === 'spitting' && "animate-spit z-50 pointer-events-none",
        showColor && !isSpymaster && "animate-ink-bleed",
        showColor ? physicalColors[typeToDisplay].outer : hiddenStyle.outer,
        "shadow-[0_4px_12px_rgb(0_0_0/0.3)]",
        !showColor && "hover:brightness-110",
        "p-1.5 sm:p-2"
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Ring Overlay (so it sits above the color background) */}
      <div className={cn(
        "absolute inset-0 rounded-lg sm:rounded-xl pointer-events-none z-20",
        isClueTarget && "ring-2 sm:ring-4 ring-inset ring-yellow-400 shadow-[inset_0_0_15px_rgba(250,204,21,0.5),0_0_15px_rgba(250,204,21,0.5)]",
        highlightedBy.length > 0 && "ring-2 sm:ring-4 ring-inset ring-white shadow-[inset_0_0_15px_rgba(255,255,255,0.5),0_0_15px_rgba(255,255,255,0.5)]",
        d20FreeReveal && !isDisabled && "ring-2 sm:ring-4 ring-inset ring-emerald-400 shadow-[inset_0_0_15px_rgba(16,185,129,0.5),0_0_15px_rgba(16,185,129,0.5)] animate-pulse"
      )} />

      {/* Gacha Pull Highlight Overlay */}
      {gachaHighlight && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            border: '4px solid #f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.3)',
            boxShadow: 'inset 0 0 25px rgba(249, 115, 22, 0.6), 0 0 20px rgba(249, 115, 22, 0.5)',
            zIndex: 50,
            pointerEvents: 'none',
            animation: 'gacha-glow 0.5s ease-in-out infinite',
          }}
        />
      )}

      {/* Fog of War Overlay */}
      {activeModifier === 'fog-of-war' && !card.revealed && (
        <div className={cn(
          "absolute inset-0 z-20 bg-slate-400/90 backdrop-blur-md transition-opacity duration-300 flex items-center justify-center pointer-events-none",
          isSwipedHover ? "opacity-0" : cn("opacity-100", !isTouchMode && "group-hover:opacity-0")
        )}>
          <CloudFog className="w-8 h-8 sm:w-10 sm:h-10 text-slate-100/70" />
        </div>
      )}

      {/* Inner Card structure */}
      <div className={cn(
        "w-full h-full flex flex-col rounded sm:rounded-md overflow-hidden border",
        showColor ? physicalColors[typeToDisplay].border : hiddenStyle.border
      )}>
        {/* Top Half */}
        <div className={cn(
          card.revealed ? "h-full w-full" : "flex-1 w-full",
          showColor ? physicalColors[typeToDisplay].top : hiddenStyle.top
        )} />
        
        {!card.revealed && (
          <>
        
        {/* Divider line */}
        <div className={cn(
          "w-full h-[2px]",
          showColor ? physicalColors[typeToDisplay].border : hiddenStyle.border
        )} />
        
        {/* Bottom Half (Text Area) */}
        <div className={cn(
          "h-[40%] sm:h-[45%] w-full relative flex items-center justify-center p-0.5 sm:p-1 shrink-0",
          showColor ? physicalColors[typeToDisplay].bottom : hiddenStyle.bottom,
          showColor ? physicalColors[typeToDisplay].text : hiddenStyle.text
        )}>
          {/* Base Word */}
          <div 
              key={`${activeModifier || 'none'}-${currentPhase}`}
              style={
                (scrambleDx !== undefined || scrambleDy !== undefined) && activeModifier !== 'earthquake'
                  ? {
                      "--scramble-dx": `${(scrambleDx ?? 0) * 108}%`,
                      "--scramble-dy": `${(scrambleDy ?? 0) * 108}%`,
                      ...(isScramblePending ? { transform: `translate(var(--scramble-dx, 0), var(--scramble-dy, 0))` } : {})
                    } as React.CSSProperties
                  : undefined
              }
              className={cn(
                "relative z-10 flex items-center justify-center h-full w-full text-center leading-none transform transition-transform",
                activeModifier === 'eroding-parchment' && currentPhase === 'operative' && isGuesser && !isRevealedForMe && "animate-eroding-parchment",
                !isScramblePending && (scrambleDx !== undefined || scrambleDy !== undefined) && activeModifier !== 'earthquake' && "animate-scramble",
                isPoltergeistInverted && !card.revealed && "rotate-180"
              )}
            >
              {isEmoji ? (
                <div className="w-full h-full flex items-center justify-center leading-none">
                  {card.word}
                </div>
              ) : activeModifier === 'marquee-madness' && !card.revealed ? (
                <div className="w-full h-full relative overflow-hidden flex items-center">
                  <div className="absolute inset-0 flex items-center justify-center whitespace-nowrap animate-marquee-scroll">
                    {card.word}
                  </div>
                </div>
              ) : (
                <svg viewBox={`0 0 ${Math.max(card.word.length * 10, 70)} 26`} className="w-full h-full drop-shadow-sm">
                  <text
                    x="50%"
                    y="55%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="currentColor"
                    className="font-bold uppercase tracking-wide"
                    style={{ fontSize: '13px' }}
                  >
                    {card.word}
                  </text>
                </svg>
              )}
            </div>
        </div>
          </>
        )}
      </div>

      {/* Highlight Indicators & Confirm Button - positioned at bottom-left to avoid hiding card text */}
      {highlightedBy.length > 0 && (
        <div className="absolute bottom-0.5 left-0.5 sm:bottom-1.5 sm:left-1.5 flex items-end gap-0.5 sm:gap-1 z-30 pointer-events-none">
          {highlightedBy.map((p, i) => (
             <img key={i} src={p.avatarBase64 || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name)}&backgroundColor=${p.team === 'red' ? 'ef4444' : '3b82f6'}`} alt={p.name} title={p.name} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-white/80 drop-shadow-md" />
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
      {isGivingClue && isValidClueTarget && !(activeModifier === 'sensory-deprivation' && currentPhase === 'spymaster' && !isSpymaster) && (
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
      
      {/* Shield Wall Lock Overlay */}
      {card.shieldedTurns !== undefined && card.shieldedTurns > 0 && (
        <div className="absolute inset-0 bg-slate-950/75 flex flex-col items-center justify-center gap-1 z-35 animate-fade-in pointer-events-none">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 border-2 border-slate-500 shadow-md flex items-center justify-center text-slate-300">
            <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <span className="text-[8px] sm:text-[10px] font-black text-slate-300 tracking-widest uppercase">LOCKED ({card.shieldedTurns}T)</span>
        </div>
      )}
    </div>
  );
}

function areEqual(prevProps: CardProps, nextProps: CardProps) {
  if (prevProps.isSpymaster !== nextProps.isSpymaster) return false;
  if (prevProps.disabled !== nextProps.disabled) return false;
  if (prevProps.playerTeam !== nextProps.playerTeam) return false;
  if (prevProps.gameMode !== nextProps.gameMode) return false;
  if (prevProps.isRTL !== nextProps.isRTL) return false;
  if (prevProps.isClueTarget !== nextProps.isClueTarget) return false;
  if (prevProps.isGivingClue !== nextProps.isGivingClue) return false;
  if (prevProps.currentPlayerId !== nextProps.currentPlayerId) return false;
  if (prevProps.activeModifier !== nextProps.activeModifier) return false;
  if (prevProps.currentPhase !== nextProps.currentPhase) return false;
  if (prevProps.scrambleDx !== nextProps.scrambleDx) return false;
  if (prevProps.scrambleDy !== nextProps.scrambleDy) return false;
  if (prevProps.isGuesser !== nextProps.isGuesser) return false;
  if (prevProps.gachaHighlight !== nextProps.gachaHighlight) return false;
  if (prevProps.d20FreeReveal !== nextProps.d20FreeReveal) return false;
  if (prevProps.isSwipedHover !== nextProps.isSwipedHover) return false;
  if (prevProps.isTouchMode !== nextProps.isTouchMode) return false;
  if (prevProps.isEaten !== nextProps.isEaten) return false;


  // Check card fields
  const c1 = prevProps.card;
  const c2 = nextProps.card;
  if (c1.id !== c2.id) return false;
  if (c1.word !== c2.word) return false;
  if (c1.type !== c2.type) return false;
  if (c1.revealed !== c2.revealed) return false;
  if (c1.revealedByA !== c2.revealedByA) return false;
  if (c1.revealedByB !== c2.revealedByB) return false;
  if (c1.duetTypeA !== c2.duetTypeA) return false;
  if (c1.duetTypeB !== c2.duetTypeB) return false;
  if (c1.shieldedTurns !== c2.shieldedTurns) return false;

  // Check highlightedBy contents
  const h1 = prevProps.highlightedBy || [];
  const h2 = nextProps.highlightedBy || [];
  if (h1.length !== h2.length) return false;
  for (let i = 0; i < h1.length; i++) {
    if (h1[i].id !== h2[i].id || h1[i].team !== h2[i].team || h1[i].name !== h2[i].name) {
      return false;
    }
  }

  return true;
}

export default memo(Card, areEqual);
