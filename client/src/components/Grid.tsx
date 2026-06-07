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
  originalWords?: string[];
  isGuesser?: boolean;
  gachaHighlightId?: number | null;
}

export default function Grid({ cards, isSpymaster, disabled, playerTeam, gameMode = 'classic', isRTL = false, clueTargets = [], isGivingClue = false, highlightedCards = {}, players = [], currentPlayerId, onCardClick, onCardContextMenu, onGuess, activeModifier, currentPhase, scrambleActive = false, originalWords = [], isGuesser = false, gachaHighlightId }: GridProps) {
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

  return (
    <div className="grid grid-cols-5 gap-1 sm:gap-2 lg:gap-3 w-full mx-auto px-1 sm:px-4">
      {cards.map((card, newIdx) => {
        let dx = 0;
        let dy = 0;
        if (scrambleActive && originalWords && originalWords.length > 0) {
          const oldIdx = originalWords.indexOf(card.word);
          if (oldIdx !== -1 && oldIdx !== newIdx) {
            const oldRow = Math.floor(oldIdx / 5);
            const oldCol = oldIdx % 5;
            const newRow = Math.floor(newIdx / 5);
            const newCol = newIdx % 5;
            dx = oldCol - newCol;
            dy = oldRow - newRow;
          }
        }

        return (
          <Card
            key={card.id}
            card={card}
            isSpymaster={isSpymaster}
            disabled={disabled}
            playerTeam={playerTeam}
            gameMode={gameMode}
            isRTL={isRTL}
            isClueTarget={clueTargets.includes(card.id)}
            isGivingClue={isGivingClue}
            highlightedBy={highlightMap[card.id] || []}
            currentPlayerId={currentPlayerId}
            onClick={onCardClick}
            onContextMenu={onCardContextMenu}
            onGuess={onGuess}
            activeModifier={activeModifier}
            currentPhase={currentPhase}
            scrambleDx={dx !== 0 ? dx : undefined}
            scrambleDy={dy !== 0 ? dy : undefined}
            isGuesser={isGuesser}
            gachaHighlight={gachaHighlightId === card.id}
          />
        );
      })}
    </div>
  );
}
