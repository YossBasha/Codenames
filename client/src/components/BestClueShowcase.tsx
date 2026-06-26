import { useEffect, useState, useMemo, useRef } from 'react';
import { Trophy, Star, Zap } from 'lucide-react';
import type { LogEntry, CueEntry, GuessEntry, GameMode } from '../../../shared/types';
import { MODIFIERS } from '../../../shared/modifiers';
import { MODIFIER_ICONS } from './GameSettingsPanel';
import { cn } from '../utils';

// ─── Best-clue computation (mirrors PostGameDebrief logic) ───────────────────

interface BestClue {
  cue: CueEntry;
  correctGuesses: GuessEntry[];
  allGuesses: GuessEntry[];
}

function computeBestClue(logs: LogEntry[], gameMode: GameMode): BestClue | null {
  let currentCue: CueEntry | null = null;
  let pendingGuesses: GuessEntry[] = [];

  const blocks: { cue: CueEntry; guesses: GuessEntry[] }[] = [];

  const isRealGuess = (word: string) => {
    const systemWords = ["Timer Expired", "Turn Ended (Timer)", "Ended Turn", "Rejected the Clue! (Mutiny)", "Clue Invalidated (Cheat)", "Pulled the Gacha Lever!"];
    if (systemWords.includes(word)) return false;
    if (word.startsWith("Rolled a ") || word.startsWith("Locked card: ") || word.startsWith("Revealed ") || word.includes("team's turn has been skipped") || word.includes("team missed!")) return false;
    return true;
  };

  for (const entry of logs) {
    if (entry.type === 'cue') {
      if (currentCue) blocks.push({ cue: currentCue, guesses: pendingGuesses });
      currentCue = entry;
      pendingGuesses = [];
    } else if (entry.type === 'guess' && currentCue) {
      if (isRealGuess(entry.cardWord) && (gameMode === 'duet' || entry.guessingTeam === currentCue.team)) {
        pendingGuesses.push(entry);
      }
    }
  }
  if (currentCue) blocks.push({ cue: currentCue, guesses: pendingGuesses });

  if (blocks.length === 0) return null;

  const isCorrect = (g: GuessEntry, cue: CueEntry) =>
    gameMode === 'duet' ? g.revealedColor === 'green' : g.revealedColor === cue.team;

  let best: BestClue | null = null;
  let bestCount = -1;

  for (const { cue, guesses } of blocks) {
    const correct = guesses.filter(g => isCorrect(g, cue));
    if (correct.length > bestCount) {
      bestCount = correct.length;
      best = { cue, correctGuesses: correct, allGuesses: guesses };
    }
  }

  // Only surface if there's at least one correct guess
  return bestCount > 0 ? best : null;
}

// ─── Sparkle particle (pure CSS) ────────────────────────────────────────────

function Sparkles() {
  const particles = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl" aria-hidden>
      {particles.map(i => {
        const angle = (i / 18) * 360;
        const radius = 42 + (i % 4) * 10;
        const size = 3 + (i % 3) * 2;
        const delay = (i * 0.08).toFixed(2);
        const x = Math.cos((angle * Math.PI) / 180) * radius;
        const y = Math.sin((angle * Math.PI) / 180) * radius;
        const colors = ['#fbbf24', '#f59e0b', '#fcd34d', '#fff7ed', '#fb923c'];
        const color = colors[i % colors.length];
        return (
          <div
            key={i}
            className="absolute rounded-full animate-sparkle-particle"
            style={{
              width: size,
              height: size,
              backgroundColor: color,
              left: `calc(50% + ${x}%)`,
              top: `calc(50% + ${y}%)`,
              animationDelay: `${delay}s`,
              boxShadow: `0 0 ${size * 2}px ${color}`,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Card chip ───────────────────────────────────────────────────────────────

function CardChip({ word, color, idx }: { word: string; color: string; idx: number }) {
  const colorMap: Record<string, string> = {
    red: 'bg-red-500 text-white shadow-red-500/40',
    blue: 'bg-blue-500 text-white shadow-blue-500/40',
    green: 'bg-emerald-500 text-white shadow-emerald-500/40',
    neutral: 'bg-stone-400 text-slate-900 shadow-stone-400/30',
    assassin: 'bg-slate-900 text-red-400 border border-red-500/60',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wide shadow-lg animate-chip-pop',
        colorMap[color] || 'bg-slate-700 text-white',
      )}
      style={{ animationDelay: `${0.65 + idx * 0.09}s` }}
    >
      {word}
    </span>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface BestClueShowcaseProps {
  logs: LogEntry[];
  gameMode: GameMode;
  onDone: () => void;
}

export default function BestClueShowcase({ logs, gameMode, onDone }: BestClueShowcaseProps) {
  const best = useMemo(() => computeBestClue(logs, gameMode), [logs, gameMode]);
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!best) { onDone(); return; }

    // Phase timeline: enter (0ms) → hold (500ms) → exit after total 5500ms
    timerRef.current = setTimeout(() => setPhase('exit'), 5200);

    const exitDone = setTimeout(() => onDone(), 5900);

    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(exitDone);
    };
  }, [best, onDone]);

  if (!best) return null;

  const { cue, correctGuesses, allGuesses } = best;
  const modifierInfo = cue.modifier ? MODIFIERS.find(m => m.id === cue.modifier) : null;
  const ModIcon = modifierInfo ? (MODIFIER_ICONS[modifierInfo.icon] ?? null) : null;

  const isRed = cue.team === 'red';
  const isDuet = gameMode === 'duet';

  const teamGradient = isDuet
    ? (isRed ? 'from-lime-500/20 via-lime-600/10 to-transparent' : 'from-emerald-500/20 via-emerald-600/10 to-transparent')
    : (isRed ? 'from-red-500/20 via-red-600/10 to-transparent' : 'from-blue-500/20 via-blue-600/10 to-transparent');

  const cardBorder = isDuet
    ? (isRed ? 'border-lime-500/60' : 'border-emerald-500/60')
    : (isRed ? 'border-red-500/60' : 'border-blue-500/60');

  const scoreGlow = isDuet
    ? (isRed ? 'shadow-lime-500/50' : 'shadow-emerald-500/50')
    : (isRed ? 'shadow-red-500/50' : 'shadow-blue-500/50');

  const scoreColor = isDuet
    ? (isRed ? 'text-lime-400' : 'text-emerald-400')
    : (isRed ? 'text-red-400' : 'text-blue-400');

  return (
    <div
      className={cn(
        'fixed inset-0 z-[300] flex items-center justify-center p-4',
        'bg-black/80 backdrop-blur-lg',
        phase === 'exit' ? 'animate-showcase-exit' : 'animate-showcase-enter',
      )}
      onClick={() => { setPhase('exit'); setTimeout(onDone, 700); }}
    >
      {/* Star burst rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] rounded-full border border-amber-500/10 animate-ring-pulse" style={{ animationDelay: '0s' }} />
        <div className="absolute w-[420px] h-[420px] rounded-full border border-amber-500/15 animate-ring-pulse" style={{ animationDelay: '0.4s' }} />
        <div className="absolute w-[260px] h-[260px] rounded-full border border-amber-500/20 animate-ring-pulse" style={{ animationDelay: '0.8s' }} />
      </div>

      {/* Main card */}
      <div
        className={cn(
          'relative w-full max-w-sm sm:max-w-md bg-[#0e0e14] rounded-3xl border-2 shadow-2xl overflow-hidden',
          cardBorder,
          phase === 'exit' ? 'animate-card-slam-out' : 'animate-card-slam-in',
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Gradient background wash */}
        <div className={cn('absolute inset-0 bg-gradient-radial pointer-events-none', teamGradient)} />

        {/* Shimmer sweep */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
          <div className="absolute inset-0 animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12" />
        </div>

        <Sparkles />

        <div className="relative z-10 p-5 sm:p-7 flex flex-col items-center gap-4">

          {/* Trophy + Title */}
          <div className="flex flex-col items-center gap-2 animate-title-drop">
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/50">
                <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-amber-950" />
              </div>
              {/* Halo */}
              <div className="absolute inset-0 rounded-2xl animate-trophy-halo border-2 border-amber-400/60" />
            </div>

            <div className="text-center">
              <div className="text-[10px] sm:text-xs font-black tracking-[0.3em] text-amber-400 uppercase animate-label-fade">
                Best Clue of the Round
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-0.5">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400 animate-star-spin" style={{ animationDelay: '0.1s' }} />
                <Star className="w-4 h-4 text-amber-300 fill-amber-300 animate-star-spin" style={{ animationDelay: '0.2s' }} />
                <Star className="w-3 h-3 text-amber-400 fill-amber-400 animate-star-spin" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>

          {/* Clue word + player */}
          <div className="w-full animate-clue-rise" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-2 mb-2">
              <img
                src={cue.player.avatarUrl}
                alt={cue.player.name}
                className="w-8 h-8 rounded-full border-2 border-white/30 shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="text-slate-400 text-xs font-bold tracking-wider truncate">{cue.player.name}</span>
            </div>

            {/* The clue itself */}
            <div className="relative bg-white rounded-2xl p-3 sm:p-4 shadow-2xl flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0 text-center">
                {cue.cueWord.startsWith('data:image') ? (
                  <img src={cue.cueWord} alt="Clue" className="h-12 sm:h-16 object-contain mx-auto" />
                ) : (
                  <span className="text-slate-900 font-black text-xl sm:text-3xl uppercase tracking-tight leading-none break-words">
                    {cue.cueWord}
                  </span>
                )}
              </div>
              <div className={cn('w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-black text-lg sm:text-2xl shrink-0 text-white shadow-xl', scoreGlow,
                isDuet ? (isRed ? 'bg-lime-500' : 'bg-emerald-500') : (isRed ? 'bg-red-500' : 'bg-blue-500')
              )}>
                {cue.cueNumber === 99 ? '∞' : cue.cueNumber}
              </div>
            </div>
          </div>

          {/* Score */}
          <div className={cn('flex items-center gap-2 animate-score-pop', scoreColor)} style={{ animationDelay: '0.4s' }}>
            <Zap className="w-4 h-4 fill-current" />
            <span className="font-black text-base sm:text-lg tracking-wider">
              {correctGuesses.length} / {allGuesses.length} correct
            </span>
          </div>

          {/* Correct guesses chips */}
          {correctGuesses.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {correctGuesses.map((g, i) => (
                <CardChip key={g.id} word={g.cardWord} color={g.revealedColor || 'neutral'} idx={i} />
              ))}
            </div>
          )}

          {/* Modifier badge */}
          {modifierInfo && (
            <div className="flex items-center gap-1.5 bg-purple-900/60 border border-purple-500/40 rounded-xl px-3 py-1 animate-label-fade" style={{ animationDelay: '0.8s' }}>
              {ModIcon && <ModIcon className="w-3.5 h-3.5 text-purple-300 shrink-0" />}
              <span className="text-purple-300 text-[10px] font-black uppercase tracking-widest">
                {modifierInfo.name}
              </span>
            </div>
          )}

          {/* Tap to dismiss */}
          <p className="text-slate-600 text-[9px] font-bold tracking-widest uppercase animate-label-fade" style={{ animationDelay: '1s' }}>
            tap anywhere to continue
          </p>
        </div>
      </div>
    </div>
  );
}
