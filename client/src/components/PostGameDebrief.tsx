import { useState, useMemo } from 'react';
import { X, Trophy } from 'lucide-react';
import type { LogEntry, CueEntry, GuessEntry, GameMode } from '../../../shared/types';
import { MODIFIERS } from '../../../shared/modifiers';
import { MODIFIER_ICONS } from './GameSettingsPanel';
import { useI18n } from '../context/I18nContext';
import { cn } from '../utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TurnBlock {
  cue: CueEntry;
  guesses: GuessEntry[];
  bonusGuesses: GuessEntry[];
  correctCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTurnBlocks(logs: LogEntry[], gameMode: GameMode): TurnBlock[] {
  const blocks: TurnBlock[] = [];
  let currentCue: CueEntry | null = null;
  let pendingGuesses: GuessEntry[] = [];

  const isRealGuess = (word: string) => {
    const systemWords = ["Timer Expired", "Turn Ended (Timer)", "Ended Turn", "Rejected the Clue! (Mutiny)", "Clue Invalidated (Cheat)", "Pulled the Gacha Lever!"];
    if (systemWords.includes(word)) return false;
    if (word.startsWith("Rolled a ") || word.startsWith("Locked card: ") || word.startsWith("Revealed ") || word.includes("team's turn has been skipped") || word.includes("team missed!")) return false;
    return true;
  };

  for (const entry of logs) {
    if (entry.type === 'cue') {
      if (currentCue) blocks.push(makeBlock(currentCue, pendingGuesses, gameMode));
      currentCue = entry;
      pendingGuesses = [];
    } else if (entry.type === 'guess') {
      if (currentCue && isRealGuess(entry.cardWord) && (gameMode === 'duet' || entry.guessingTeam === currentCue.team)) {
        pendingGuesses.push(entry);
      }
    }
  }
  if (currentCue) blocks.push(makeBlock(currentCue, pendingGuesses, gameMode));

  return blocks;
}

function makeBlock(cue: CueEntry, guesses: GuessEntry[], gameMode: GameMode): TurnBlock {
  const allowedCount = cue.cueNumber === 99 ? Infinity : cue.cueNumber;

  const isCorrect = (g: GuessEntry) =>
    gameMode === 'duet' ? g.revealedColor === 'green' : g.revealedColor === cue.team;

  let correctSoFar = 0;
  const regularGuesses: GuessEntry[] = [];
  const bonusGuesses: GuessEntry[] = [];

  for (const g of guesses) {
    if (isCorrect(g)) {
      correctSoFar++;
      if (correctSoFar > allowedCount) bonusGuesses.push(g);
      else regularGuesses.push(g);
    } else {
      regularGuesses.push(g);
    }
  }

  return { cue, guesses: regularGuesses, bonusGuesses, correctCount: guesses.filter(isCorrect).length };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ src, name, size = 'md' }: { src: string; name: string; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-6 h-6 text-[8px]' : 'w-8 h-8 text-[10px]';
  const initials = name.trim().split(/\s+/).map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';

  if (!src) {
    return (
      <div className={cn('rounded-full bg-slate-700 flex items-center justify-center font-black text-white shrink-0', cls)}>
        {initials}
      </div>
    );
  }
  return (
    <img src={src} alt={name} className={cn('rounded-full shrink-0 border border-white/20', cls)}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
  );
}

function CardChip({ word, color, isStar }: { word: string; color: string; isStar?: boolean }) {
  const colorMap: Record<string, string> = {
    red: 'bg-red-500 text-white',
    blue: 'bg-blue-500 text-white',
    green: 'bg-emerald-500 text-white',
    neutral: 'bg-stone-400 text-slate-900',
    assassin: 'bg-slate-900 text-red-400 border border-red-500/50',
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-black text-[10px] sm:text-xs uppercase tracking-wide shadow-sm',
      colorMap[color] || 'bg-slate-700 text-white',
      isStar && 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900',
    )}>
      {word}
    </span>
  );
}

// ─── Turn card ────────────────────────────────────────────────────────────────

function TurnCard({ block, isBest, index, gameMode, onZoomDoodle }: {
  block: TurnBlock;
  isBest: boolean;
  index: number;
  gameMode: GameMode;
  onZoomDoodle?: (url: string) => void;
}) {
  const { t } = useI18n();
  const { cue, guesses, bonusGuesses } = block;
  const isRed = cue.team === 'red';
  const isDuet = gameMode === 'duet';

  const teamAccent = isDuet
    ? (isRed ? 'border-lime-500/60 shadow-lime-500/10' : 'border-emerald-500/60 shadow-emerald-500/10')
    : (isRed ? 'border-red-500/60 shadow-red-500/10' : 'border-blue-500/60 shadow-blue-500/10');

  const spyBg = isDuet
    ? (isRed ? 'from-lime-600 to-lime-800' : 'from-emerald-600 to-emerald-800')
    : (isRed ? 'from-red-600 to-red-800' : 'from-blue-600 to-blue-800');

  const numBg = isDuet
    ? (isRed ? 'bg-lime-400 text-lime-950' : 'bg-emerald-400 text-emerald-950')
    : (isRed ? 'bg-red-400 text-red-950' : 'bg-blue-400 text-blue-950');

  const modifierInfo = cue.modifier ? MODIFIERS.find(m => m.id === cue.modifier) : null;
  const ModIcon = modifierInfo ? (MODIFIER_ICONS[modifierInfo.icon] ?? null) : null;

  return (
    <div
      className={cn(
        'relative rounded-2xl border bg-slate-800/80 backdrop-blur-sm shadow-lg p-3 sm:p-4',
        'animate-slide-in-turn',
        teamAccent,
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Best clue badge */}
      {isBest && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-amber-400 text-amber-950 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-lg shadow-amber-500/30 whitespace-nowrap">
          <Trophy className="w-2.5 h-2.5" />
          {t("best_clue")}
        </div>
      )}

      {/* Spymaster row */}
      <div className={cn('flex items-center gap-2 rounded-xl bg-gradient-to-r p-2 shadow-inner', spyBg)}>
        <Avatar src={cue.player.avatarUrl} name={cue.player.name} size="md" />
        <span className="text-white/70 text-[9px] font-bold uppercase tracking-wide shrink-0">
          {cue.player.name}
        </span>

        <div className={cn("flex-1 min-w-0 bg-white rounded-xl px-2 py-1 flex items-center justify-center shadow-inner min-h-[28px] relative", cue.invalidated && "opacity-70 grayscale")}>
          {cue.invalidated && (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm border border-red-400 rotate-[-4deg] flex items-center gap-0.5 uppercase tracking-widest">
                INVALIDATED
              </span>
            </div>
          )}
          <div className={cn("w-full flex items-center justify-center", cue.invalidated && "blur-[3px] brightness-75 select-none")}>
            {cue.cueWord.startsWith('data:image') ? (
              <img 
                src={cue.cueWord} 
                alt="Clue" 
                className="h-6 object-contain mx-auto cursor-pointer hover:scale-110 transition-transform" 
                onClick={() => onZoomDoodle && onZoomDoodle(cue.cueWord)}
              />
            ) : (
              <span className="text-slate-900 font-black text-xs sm:text-sm uppercase tracking-tight truncate">
                {cue.cueWord}
              </span>
            )}
          </div>
        </div>

        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 shadow-md', numBg)}>
          {cue.cueNumber === 99 ? '∞' : cue.cueNumber}
        </div>
      </div>

      {/* Chaos modifier badge */}
      {modifierInfo && (
        <div className="mt-2 flex items-center gap-1.5 bg-purple-900/50 border border-purple-500/40 rounded-xl px-2.5 py-1 w-fit">
          {ModIcon && <ModIcon className="w-3 h-3 text-purple-300 shrink-0" />}
          <span className="text-purple-300 text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
            {modifierInfo.name}
          </span>
        </div>
      )}

      {/* Intended Targets */}
      {cue.targetWords && cue.targetWords.length > 0 && (
        <div className="mt-2.5 flex items-center gap-1.5 border-t border-slate-700/50 pt-2.5">
          <span className="text-slate-400 text-[9px] font-black uppercase tracking-widest shrink-0">{t("intended_targets")}</span>
          <div className="flex flex-wrap gap-1 items-center">
            {cue.targetWords.map((word, i) => {
              const matchedGuess = [...guesses, ...bonusGuesses].find(g => g.cardWord === word);
              if (matchedGuess) {
                return <CardChip key={i} word={word} color={matchedGuess.revealedColor || 'neutral'} />;
              }
              return (
               <span key={i} className="text-[10px] font-bold text-white bg-slate-700/50 px-1.5 py-0.5 rounded border border-slate-600/50 shadow-sm">{word}</span>
              );
            })}
          </div>
        </div>
      )}

      {/* Guesses */}
      {(guesses.length > 0 || bonusGuesses.length > 0) && (
        <div className="mt-2.5 flex flex-col gap-1.5 border-t border-slate-700/50 pt-2.5">
          <span className="text-slate-400 text-[9px] font-black uppercase tracking-widest shrink-0">{t("guesses_label")}</span>
          {guesses.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              {guesses.map((g) => (
                <div key={g.id} className="flex items-center gap-1 bg-slate-900/40 rounded-full pr-1">
                  <Avatar src={g.player?.avatarUrl || ''} name={g.player?.name || '?'} size="sm" />
                  <CardChip word={g.cardWord} color={g.revealedColor || 'neutral'} />
                </div>
              ))}
            </div>
          )}

          {bonusGuesses.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-amber-400 font-black text-[9px] uppercase tracking-widest shrink-0">
                {t("bonus_label")}
              </span>
              {bonusGuesses.map((g) => (
                <div key={g.id} className="flex items-center gap-1 bg-slate-900/40 rounded-full pr-1">
                  <Avatar src={g.player?.avatarUrl || ''} name={g.player?.name || '?'} size="sm" />
                  <CardChip word={g.cardWord} color={g.revealedColor || 'neutral'} isStar />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {guesses.length === 0 && bonusGuesses.length === 0 && (
        <p className="mt-2 text-slate-500 text-xs italic text-center">{t("no_guesses_turn")}</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PostGameDebriefProps {
  logs: LogEntry[];
  gameMode: GameMode;
  onClose: () => void;
}

export default function PostGameDebrief({ logs, gameMode, onClose }: PostGameDebriefProps) {
  const { t } = useI18n();
  const [activeTeam, setActiveTeam] = useState<'all' | 'red' | 'blue'>('all');
  const [zoomedDoodle, setZoomedDoodle] = useState<string | null>(null);

  const allBlocks = useMemo(() => buildTurnBlocks(logs, gameMode), [logs, gameMode]);

  const bestBlockIndex = useMemo(() => {
    if (allBlocks.length === 0) return -1;
    let max = -1;
    let bestIdx = 0;
    allBlocks.forEach((b, i) => { if (b.correctCount > max) { max = b.correctCount; bestIdx = i; } });
    return max > 0 ? bestIdx : -1;
  }, [allBlocks]);

  const filteredBlocks = useMemo(() => {
    if (activeTeam === 'all') return allBlocks;
    return allBlocks.filter(b => b.cue.team === activeTeam);
  }, [allBlocks, activeTeam]);

  const isDuet = gameMode === 'duet';

  const tabClasses = (tab: 'all' | 'red' | 'blue') => cn(
    'flex-1 py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all',
    activeTeam === tab ? 'bg-slate-600 text-white shadow-inner' : 'text-slate-400 hover:text-white',
  );

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="relative w-full sm:max-w-lg bg-[#141414] sm:rounded-3xl rounded-t-3xl border border-slate-700/60 shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[88dvh] animate-debrief-panel">

        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-3 border-b border-slate-700/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Trophy className="w-4 h-4 text-amber-950" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-widest uppercase">{t("game_debrief")}</h2>
              <p className="text-[10px] text-slate-400 font-medium">{t("clues_given").replace("{count}", allBlocks.length.toString())}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Team filter tabs (classic only) */}
        {!isDuet && (
          <div className="flex gap-1 px-4 pt-3 pb-1 shrink-0 bg-slate-800/40">
            <button className={tabClasses('all')} onClick={() => setActiveTeam('all')}>All</button>
            <button className={tabClasses('red')} onClick={() => setActiveTeam('red')}>
              <span className="text-red-400">● </span>Red
            </button>
            <button className={tabClasses('blue')} onClick={() => setActiveTeam('blue')}>
              <span className="text-blue-400">● </span>Blue
            </button>
          </div>
        )}

        {/* Turn cards */}
        <div className="flex-1 overflow-y-auto p-4 pt-3 flex flex-col gap-4 scrollbar-thin">
          {filteredBlocks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm italic">
              No clues recorded
            </div>
          ) : (
            filteredBlocks.map((block, i) => {
              const globalIdx = allBlocks.indexOf(block);
              return (
                <TurnCard
                  key={block.cue.id}
                  block={block}
                  isBest={globalIdx === bestBlockIndex}
                  index={i}
                  gameMode={gameMode}
                  onZoomDoodle={setZoomedDoodle}
                />
              );
            })
          )}
          <div className="h-2" />
        </div>

        {/* Close button */}
        <div className="p-4 pt-2 border-t border-slate-700/50 bg-slate-800/20 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-black uppercase tracking-widest text-sm rounded-xl transition-all shadow-md"
          >
            {t("close_upper")}
          </button>
        </div>
      </div>

      {/* Zoom Modal */}
      {zoomedDoodle && (
        <div 
          className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setZoomedDoodle(null)}
        >
          <img 
            src={zoomedDoodle} 
            alt="Zoomed doodle" 
            className="w-full max-w-3xl max-h-[85vh] object-contain rounded-xl bg-white/5 border-2 border-white/10 p-2 shadow-2xl"
          />
          <p className="text-slate-400 mt-6 font-black uppercase tracking-widest text-xs">Tap anywhere to close</p>
        </div>
      )}
    </div>
  );
}
