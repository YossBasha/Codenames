export interface Modifier {
  id: string;
  name: string;
  category: 'spymaster' | 'board' | 'guesser';
  description: string;
  icon: string; // matches the Lucide icon name to render on client
}

export const MODIFIERS: Modifier[] = [
  {
    id: 'off-by-one',
    name: 'Off-By-One Error',
    category: 'spymaster',
    description: 'The Spymaster must give a clue number that is exactly +1 or -1 of their intended target. (e.g. if the target is 2, type 1 or 3).',
    icon: 'Binary'
  },
  {
    id: 'vowel-void',
    name: 'Vowel Void',
    category: 'spymaster',
    description: "The Spymaster's clue cannot contain the letters 'A' or 'E' (case-insensitive). Any 'A' or 'E' entered will be stripped upon submission!",
    icon: 'FileText'
  },
  {
    id: 'oracle-riddle',
    name: "The Oracle's Riddle",
    category: 'spymaster',
    description: 'The Spymaster must give a two-word clue, and the two words must be an exact rhyming pair (e.g., "Red Bed", "Tall Wall"). Spaces are allowed.',
    icon: 'HelpCircle'
  },
  {
    id: 'sensory-deprivation',
    name: 'Sensory Deprivation',
    category: 'spymaster',
    description: "The Spymaster has only 5 seconds of visibility to study the board colors at the start of their turn before all colors fade to neutral.",
    icon: 'EyeOff'
  },
  {
    id: 'dimensional-scramble',
    name: 'Dimensional Scramble',
    category: 'board',
    description: 'Chaos! Three random unrevealed cards have swapped positions in the grid layout.',
    icon: 'Shuffle'
  },
  {
    id: 'the-mimic',
    name: 'The Mimic',
    category: 'board',
    description: 'Secret danger! One random unrevealed Neutral card acts as the Assassin for this turn only.',
    icon: 'Ghost'
  },
  {
    id: 'eroding-parchment',
    name: 'Eroding Parchment',
    category: 'guesser',
    description: 'The text on unrevealed cards slowly blurs and fades away over 30 seconds during the guessing phase. Act fast!',
    icon: 'Wind'
  },
  {
    id: 'critical-hit',
    name: 'Critical Hit',
    category: 'guesser',
    description: 'Pauses the turn timer! If the guessing team clicks their first correct card within 5 seconds of clue submission, the countdown stops.',
    icon: 'Zap'
  },
  {
    id: 'blood-pact',
    name: 'Blood Pact',
    category: 'guesser',
    description: 'Click "Blood Pact" to safely reveal one card color. Once used, your turn is hard-capped to exactly one standard guess afterward.',
    icon: 'HeartHandshake'
  },
  {
    id: 'gacha-pull',
    name: 'Gacha Pull',
    category: 'guesser',
    description: 'Leverage pure chance! Click "Pull Lever" to randomly select and reveal an unrevealed card on the board.',
    icon: 'Dices'
  },
  {
    id: 'shield-wall',
    name: 'Shield Wall',
    category: 'guesser',
    description: 'Lock a card down! Click "Lock Card" and select any card to disable guesses on it for the next 2 turns.',
    icon: 'Shield'
  },
  {
    id: 'lag-spike',
    name: 'Lag Spike',
    category: 'guesser',
    description: 'Forced network delay! Operatives are locked out of guessing for 15 seconds at the start of the turn.',
    icon: 'WifiOff'
  },
  {
    id: 'haste',
    name: 'Haste',
    category: 'guesser',
    description: 'Ultra-fast turn! The guessing team has exactly 15 seconds to make all of their guesses before their turn ends.',
    icon: 'Flame'
  }
];
