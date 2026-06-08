import type { Card as CardType } from "../../../shared/types";
import Card from "./Card";

import type { Player } from "../../../shared/types";

interface GridProps {
  cards: CardType[];
  isSpymaster: boolean;
  disabled?: boolean;
  playerTeam?: string;
  gameMode?: 'classic' | 'duet';
  isRTL?: boolean;
  clueTargets?: number[];
  isGivingClue?: boolean;
  highlightedCards?: Record<string, number[]>;
  players?: Player[];
  currentPlayerId?: string;
  onCardClick: (id: number) => void;
  onCardContextMenu?: (e: React.MouseEvent, id: number) => void;
  onGuess?: (id: number) => void;
  activeModifier?: string | null;
  currentPhase?: 'spymaster' | 'operative';
  scrambleActive?: boolean;
  isScramblePending?: boolean;
  originalWords?: Record<number, string>;
  isGuesser?: boolean;
  gachaHighlightId?: number | null;
  d20FreeReveal?: boolean;
  invertedCardIds?: number[];
}

export default function Grid({ cards, isSpymaster, disabled, playerTeam, gameMode = 'classic', isRTL = false, clueTargets = [], isGivingClue = false, highlightedCards = {}, players = [], currentPlayerId, onCardClick, onCardContextMenu, onGuess, activeModifier, currentPhase, scrambleActive, isScramblePending, originalWords, isGuesser, gachaHighlightId, d20FreeReveal, invertedCardIds = [] }: GridProps) {
  if (!cards || cards.length === 0) return null;

  // Pre-calculate highlighting players per card to avoid O(N * M) lookup inside the loop
  const highlightMap: Record<number, Player[]> = {};
  for (const [pId, cardIds] of Object.entries(highlightedCards)) {
    const player = players.find(p => p.id === pId);
    if (player) {
      for (const cardId of cardIds) {
        if (!highlightMap[cardId]) {
          highlightMap[cardId] = [];
        }
        highlightMap[cardId].push(player);
      }
    }
  }

  const getDx = (id: number) => {
    if (!originalWords) return 0;
    const newIdx = cards.findIndex(c => c.id === id);
    const oldIdx = Object.keys(originalWords).find(key => originalWords[Number(key)] === cards[newIdx].word);
    if (oldIdx !== undefined && Number(oldIdx) !== newIdx) {
      const oldCol = Number(oldIdx) % 5;
      const newCol = newIdx % 5;
      return oldCol - newCol;
    }
    return 0;
  };

  const getDy = (id: number) => {
    if (!originalWords) return 0;
    const newIdx = cards.findIndex(c => c.id === id);
    const oldIdx = Object.keys(originalWords).find(key => originalWords[Number(key)] === cards[newIdx].word);
    if (oldIdx !== undefined && Number(oldIdx) !== newIdx) {
      const oldRow = Math.floor(Number(oldIdx) / 5);
      const newRow = Math.floor(newIdx / 5);
      return oldRow - newRow;
    }
    return 0;
  };

  return (
    <div className="grid grid-cols-5 gap-1 sm:gap-2 lg:gap-3 w-full mx-auto px-1 sm:px-4" dir="ltr">
      {cards.map((c) => {
        return (
          <Card
            key={c.id}
            card={c}
            isSpymaster={isSpymaster}
            disabled={disabled}
            playerTeam={playerTeam}
            gameMode={gameMode}
            isRTL={isRTL}
            isClueTarget={clueTargets.includes(c.id)}
            isGivingClue={isGivingClue}
            highlightedBy={highlightMap[c.id] || []}
            currentPlayerId={currentPlayerId}
            onClick={onCardClick}
            onContextMenu={onCardContextMenu}
            onGuess={onGuess}
            activeModifier={activeModifier}
            currentPhase={currentPhase}
            scrambleDx={(scrambleActive || isScramblePending) ? getDx(c.id) : undefined}
            scrambleDy={(scrambleActive || isScramblePending) ? getDy(c.id) : undefined}
            isScramblePending={isScramblePending}
            isGuesser={isGuesser}
            gachaHighlight={gachaHighlightId === c.id}
            d20FreeReveal={d20FreeReveal}
            isPoltergeistInverted={invertedCardIds.includes(c.id)}
          />
        );
      })}
    </div>
  );
}
