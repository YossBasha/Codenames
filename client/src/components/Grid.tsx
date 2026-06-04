import type { Card as CardType } from "../../../shared/types";
import Card from "./Card";

interface GridProps {
  cards: CardType[];
  isSpymaster: boolean;
  disabled?: boolean;
  playerTeam?: string;
  gameMode?: 'classic' | 'duet';
  isRTL?: boolean;
  clueTargets?: number[];
  isGivingClue?: boolean;
  onCardClick: (id: number) => void;
}

export default function Grid({ cards, isSpymaster, disabled, playerTeam, gameMode = 'classic', isRTL = false, clueTargets = [], isGivingClue = false, onCardClick }: GridProps) {
  if (!cards || cards.length === 0) return null;

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
          onClick={onCardClick}
        />
      ))}
    </div>
  );
}
