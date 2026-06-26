export type Team = 'red' | 'blue' | 'spectator';
export type CardType = 'red' | 'blue' | 'neutral' | 'assassin' | 'green';
export type Role = 'spymaster' | 'operative' | 'spectator';
export type Language = 'en' | 'ar' | 'all' | 'du' | 'ge' | 'fr' | 'es';
export type GameMode = 'classic' | 'duet';
export interface Card {
    id: number;
    word: string;
    type: CardType;
    revealed: boolean;
    duetTypeA?: CardType;
    duetTypeB?: CardType;
    revealedByA?: boolean;
    revealedByB?: boolean;
    shieldedTurns?: number;
}
export interface Player {
    id: string;
    sessionId?: string;
    connected?: boolean;
    name: string;
    team: Team | 'spectator';
    role: Role | 'spectator';
    isBot?: boolean;
    avatarBase64?: string;
}
export interface CueEntry {
    id: string;
    type: 'cue';
    player: {
        name: string;
        avatarUrl: string;
    };
    team: 'red' | 'blue';
    cueWord: string;
    cueNumber: number;
    targets?: number[];
    targetWords?: string[];
    reasoning?: string;
    modifier?: string | null;
    invalidated?: boolean;
    declaredFair?: boolean;
    timestamp: number;
}
export interface GuessEntry {
    id: string;
    type: 'guess';
    player: {
        name: string;
        avatarUrl: string;
    };
    guessingTeam: 'red' | 'blue';
    cardWord: string;
    revealedColor: CardType;
    timestamp: number;
}
export type LogEntry = CueEntry | GuessEntry;
export interface TimerSettings {
    preset: 'off' | 'quick' | 'relaxed' | 'custom';
    spymasterTime: number;
    operativeTime: number;
    extraFirstClueTime: number;
}
export type CustomWordWeight = 'none' | 'few' | 'some' | 'many';
export type ThemeType = 'default' | 'cyberpunk' | 'noir';
export type ClueType = 'text' | 'doodle' | 'both';
export interface GameState {
    gameMode: GameMode;
    timerSettings: TimerSettings;
    isFirstTurnOfGame: boolean;
    timeRemaining: number;
    timerTokens: number;
    isRTL?: boolean;
    cards: Card[];
    currentTurn: Team;
    currentPhase: 'spymaster' | 'operative';
    activeCue: string | null;
    activeCueNumber: number | null;
    successfulGuessesThisTurn: number;
    winner: Team | null;
    redScore: number;
    blueScore: number;
    language: Language;
    gameLog: LogEntry[];
    highlightedCards?: Record<string, number[]>;
    clueType: ClueType;
    chaosMode?: boolean;
    activeModifier?: string | null;
    modifierState?: any;
    enabledModifiers?: string[];
    nimnimsCooldown?: number;
    cheatVoteState?: {
        active: boolean;
        clueId: string;
        clueWord: string;
        submitterId: string;
        submitterName: string;
        votes: Record<string, 'yes' | 'no'>;
    };
}
//# sourceMappingURL=types.d.ts.map