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
}

export default function Grid({ cards, isSpymaster, disabled, playerTeam, gameMode = 'classic', isRTL = false, clueTargets = [], isGivingClue = false, highlightedCards = {}, players = [], currentPlayerId, onCardClick, onCardContextMenu, onGuess, activeModifier, currentPhase }: GridProps) {
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
      {cards.map((card) => (
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
        />
      ))}
    </div>
  );
}
