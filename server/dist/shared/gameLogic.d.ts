import type { Card, Language, Team, CustomWordWeight } from './types';
export declare function shuffleArray<T>(array: T[]): T[];
export declare function buildFinalWordList(language: Language, selectedPacks: string[], customWords: string[], customWordWeight: CustomWordWeight): string[];
export declare function generateGrid(language: Language, selectedPacks?: string[], customWords?: string[], customWordWeight?: CustomWordWeight): {
    cards: Card[];
    startingTeam: Team;
};
export declare function generateDuetGrid(language: Language, selectedPacks?: string[], customWords?: string[], customWordWeight?: CustomWordWeight): {
    cards: Card[];
    startingTeam: Team;
};
//# sourceMappingURL=gameLogic.d.ts.map