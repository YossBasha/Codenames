export declare function loadEmbeddings(): void;
export declare function cosineSimilarity(vecA: number[], vecB: number[]): number;
export declare function getEnglishEquivalent(word: string, language: string): string;
export declare function getWordVector(word: string, language: string): number[] | null;
export declare function getAllDictionaryWords(): string[];
/**
 * NEW ALGORITHM: Safety-First, Strict Threshold Spymaster Clue Generation
 *
 * Core principle: Build clues that connect to multiple friendly words ONLY if all
 * connections exceed high similarity thresholds. Heavily penalize danger associations.
 * Try target counts from 4 down to 1, always preferring safer, smaller clues.
 */
export declare function getBotSpymasterClue(cards: import("../../../shared/types").Card[], team: import("../../../shared/types").Team, language: string, isDuet: boolean, activeModifier?: string | null, modifierState?: any): {
    word: string;
    count: number;
    reasoning?: string;
} | null;
export declare function rankCardsForOperative(clue: string, cards: import("../../../shared/types").Card[], team: import("../../../shared/types").Team, language: string, isDuet: boolean, activeModifier?: string | null, modifierState?: any): import("../../../shared/types").Card[];
export declare function getLLMSpymasterClue(cards: import("../../../shared/types").Card[], team: import("../../../shared/types").Team, language: string, isDuet: boolean, activeModifier?: string | null, modifierState?: any): Promise<{
    word: string;
    count: number;
    reasoning?: string;
} | null>;
export declare function getLLMOperativeRankings(clue: string, count: number, cards: import("../../../shared/types").Card[], team: import("../../../shared/types").Team, language: string, isDuet: boolean, activeModifier?: string | null, modifierState?: any): Promise<{
    cards: import("../../../shared/types").Card[];
    reasoning?: string;
}>;
//# sourceMappingURL=aiLogic.d.ts.map