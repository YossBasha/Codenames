export type Team = 'red' | 'blue' | 'spectator';
export type CardType = 'red' | 'blue' | 'neutral' | 'assassin' | 'green';
export type Role = 'spymaster' | 'operative' | 'spectator';
export type Language = 'en' | 'ar' | 'de' | 'all';
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
}
export interface Player {
    id: string;
    name: string;
    team: Team;
    role: Role;
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
}
//# sourceMappingURL=types.d.ts.map