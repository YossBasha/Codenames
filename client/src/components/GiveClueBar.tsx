import { useState, useEffect } from 'react';
import { PenTool, Send, X } from 'lucide-react';
import DrawingModal from './DrawingModal';
import { checkRhyme } from '../../../shared/modifiers';
import type { ClueType } from '../../../shared/types';
import { useI18n } from '../context/I18nContext';

interface GiveClueBarProps {
  onSubmitCue: (cue: string, num: number) => void;
  clueType?: ClueType;
  activeModifier?: string | null;
  clueTargetCount?: number;
  isRTL?: boolean;
  modifierState?: any;
  unrevealedWords?: string[];
}

function isCheatClue(clue: string, unrevealedWords: string[]): string | null {
  if (!clue || clue.startsWith('data:image')) return null;
  const c = clue.toLowerCase().trim();
  if (c.length < 2) return null; // Too short to judge

  for (const w of unrevealedWords) {
    const boardWord = w.toLowerCase();
    if (boardWord.includes(c) || c.includes(boardWord)) {
      return w; // Return the exact word it conflicts with
    }
  }
  return null;
}

export default function GiveClueBar({
  onSubmitCue,
  clueType = 'both',
  activeModifier,
  clueTargetCount = 0,
  isRTL = false,
  modifierState,
  unrevealedWords = []
}: GiveClueBarProps) {
  const [cueInput, setCueInput] = useState('');
  const [numInput, setNumInput] = useState<number | ''>('');
  const [showDrawingModal, setShowDrawingModal] = useState(false);
  const { t } = useI18n();

  const disableDoodleModifiers = [
    'off-by-one',
    'vowel-void',
    'oracle-riddle',
    'five-letter-curse',
    'forced-acronym',
    'boolean-search'
  ];
  const isDoodleDisabled = !!(activeModifier && disableDoodleModifiers.includes(activeModifier));
  const effectiveClueType: ClueType = isDoodleDisabled ? 'text' : clueType;
  const limit = activeModifier === 'five-letter-curse' ? 5 : 32;

  const [isFullScreenInput, setIsFullScreenInput] = useState(false);
  const [focusedField, setFocusedField] = useState<'word' | 'number'>('word');

  useEffect(() => {
    if (activeModifier === 'the-dictator' && modifierState?.forcedNumber !== undefined) {
      setNumInput(modifierState.forcedNumber);
    } else if (clueTargetCount > 0) {
      setNumInput(clueTargetCount);
    }
  }, [clueTargetCount, activeModifier, modifierState]);

  const handleWordChange = (val: string) => {
    if (val.length > limit) return;
    if (activeModifier === 'oracle-riddle' || activeModifier === 'boolean-search' || activeModifier === 'forced-acronym') {
      const cleanVal = val.replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, '');
      if (activeModifier === 'oracle-riddle') {
        const words = cleanVal.trim().split(/\s+/).filter(Boolean);
        if (words.length > 2) return;
      } else if (activeModifier === 'forced-acronym') {
        const words = cleanVal.trim().split(/\s+/).filter(Boolean);
        if (words.length > (modifierState?.acronym?.split('-').length || 3)) return;
      }
      setCueInput(cleanVal);
    } else {
      setCueInput(val.replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, ''));
    }
  };

  const handleNumberChange = (val: string) => {
    const cleanVal = val.replace(/[^0-9∞]/g, '');
    if (cleanVal.includes('∞')) {
      setNumInput(99);
    } else if (cleanVal === '') {
      setNumInput('');
    } else {
      const num = parseInt(cleanVal, 10);
      if (num === 99) {
        setNumInput(99);
      } else if (num > 9) {
        setNumInput(num % 10);
      } else {
        setNumInput(num);
      }
    }
  };

  const isNumberValid = () => {
    if (numInput === '') return false;
    if (activeModifier === 'the-dictator') {
      return numInput === modifierState?.forcedNumber;
    }
    if (numInput === 99) return clueTargetCount === 0;
    if (clueTargetCount > 0) {
      return numInput === clueTargetCount;
    }
    return true;
  };

  const isOracleRiddleValid = () => {
    if (activeModifier !== 'oracle-riddle') return true;
    const words = cueInput.trim().split(/\s+/).filter(Boolean);
    if (words.length !== 2) return false;
    return checkRhyme(words[0], words[1], !!isRTL);
  };

  const isFiveLetterCurseValid = () => {
    if (activeModifier !== 'five-letter-curse') return true;
    return cueInput.trim().length === 5;
  };

  const isBooleanSearchValid = () => {
    if (activeModifier !== 'boolean-search') return true;
    const matches = cueInput.match(/\s+(AND|OR|NOT)\s+/g);
    return matches !== null && matches.length === 1;
  };

  const isForcedAcronymValid = () => {
    if (activeModifier !== 'forced-acronym' || !modifierState?.acronym) return true;
    const letters = modifierState.acronym.split('-');
    const words = cueInput.trim().split(/\s+/).filter(Boolean);
    if (words.length !== letters.length) return false;
    
    for (let i = 0; i < letters.length; i++) {
      if (words[i][0].toLowerCase() !== letters[i].toLowerCase()) {
        return false;
      }
    }
    return true;
  };

  const cheatConflict = unrevealedWords.length > 0 ? isCheatClue(cueInput, unrevealedWords) : null;

  const handleSubmitCue = (e: React.FormEvent) => {
    e.preventDefault();
    if (cueInput.trim().length > 0 && numInput !== '' && onSubmitCue) {
      onSubmitCue(cueInput, Number(numInput));
      setCueInput('');
      setNumInput('');
    }
  };

  const handleDrawingSubmit = (dataUrl: string) => {
    // Only stage the drawing — the clue is sent when the spymaster clicks "Give clue"
    setCueInput(dataUrl);
    setShowDrawingModal(false);
  };

  return (
    <>
      {isFullScreenInput && (
        <div className="fixed inset-0 z-[9999] bg-black/80 sm:hidden flex flex-col animate-fade-in">
          <div className="w-full bg-white flex items-center shadow-2xl p-1">
            <div className="flex-1 relative flex items-center min-w-0">
              <input
                autoFocus={focusedField === 'word'}
                type="text"
                placeholder={activeModifier === 'oracle-riddle' ? t('enter_rhyme_placeholder') : t('enter_clue_placeholder')}
                value={cueInput.startsWith('data:image') ? t('doodle_clue_ready') : cueInput}
                readOnly={cueInput.startsWith('data:image')}
                onChange={(e) => handleWordChange(e.target.value)}
                className="w-full bg-transparent text-slate-900 text-[17px] pl-3 pr-10 py-3 outline-none font-medium placeholder:text-slate-400"
                maxLength={limit}
              />
              {cueInput.startsWith('data:image') && (
                <button
                  type="button"
                  onClick={() => setCueInput('')}
                  className="absolute right-2 p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="h-8 w-px bg-slate-300 mx-1 shrink-0" />
            <input
              autoFocus={focusedField === 'number'}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="-"
              value={numInput === 99 ? '∞' : numInput}
              onChange={(e) => handleNumberChange(e.target.value)}
              disabled={activeModifier === 'the-dictator'}
              className="w-[50px] bg-transparent text-slate-900 text-xl px-1 py-3 text-center outline-none font-black placeholder:text-slate-400 shrink-0"
            />
            <button
              type="button"
              onClick={() => setIsFullScreenInput(false)}
              className="ml-1 mr-1 px-5 py-2.5 bg-slate-200 active:bg-slate-300 text-slate-800 rounded-full font-bold text-sm transition-colors shrink-0"
            >
              Done
            </button>
          </div>
          <div className="flex-1 w-full" onClick={() => setIsFullScreenInput(false)} />
        </div>
      )}

      <div className="w-full shrink-0 max-w-3xl mx-auto mt-4 sm:mt-6 lg:mt-2 px-2 sm:px-4 animate-fade-in relative z-20 flex flex-col items-center">
        <form 
          onSubmit={handleSubmitCue} 
          className="w-full bg-slate-800/95 backdrop-blur-md border border-slate-700/80 rounded-2xl sm:rounded-full p-2 flex items-center gap-2 shadow-2xl"
        >
          {effectiveClueType !== 'text' && (
            <button
              type="button"
              onClick={() => setShowDrawingModal(true)}
              className="p-2.5 sm:p-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl sm:rounded-full transition-colors flex-shrink-0 cursor-pointer"
              title={t('draw_clue_title')}
            >
              <PenTool className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}

          {effectiveClueType !== 'doodle' && (
            <div className="flex-1 min-w-0 relative">
              <input 
                type="text" 
                placeholder={activeModifier === 'oracle-riddle' ? t('enter_rhyme_placeholder') : t('enter_clue_placeholder')}
                value={cueInput.startsWith('data:image') ? t('doodle_clue_ready') : cueInput}
                readOnly={cueInput.startsWith('data:image')}
                onChange={(e) => handleWordChange(e.target.value)}
                onFocus={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 640) {
                    setFocusedField('word');
                    setIsFullScreenInput(true);
                  }
                }}
                className="w-full bg-slate-900/80 border border-slate-700/50 focus:border-slate-500/80 text-white pl-3.5 pr-14 py-2.5 sm:py-3.5 rounded-xl sm:rounded-full outline-none text-sm sm:text-base placeholder:text-slate-500 font-bold"
                maxLength={limit}
              />
              {!cueInput.startsWith('data:image') && (
                <span className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] sm:text-xs font-bold pointer-events-none select-none transition-colors ${cueInput.length >= limit ? 'text-red-500' : 'text-slate-500'}`}>
                  {cueInput.length}/{limit}
                </span>
              )}
              {cueInput.startsWith('data:image') && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCueInput('');
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-red-400 transition-colors z-10"
                  title={t('cancel') || "Cancel Doodle"}
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <input 
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="-"
              value={numInput === 99 ? '∞' : numInput}
              onChange={(e) => handleNumberChange(e.target.value)}
              onFocus={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 640) {
                  setFocusedField('number');
                  setIsFullScreenInput(true);
                }
              }}
              disabled={activeModifier === 'the-dictator'}
              className={`bg-slate-900 border border-slate-700/50 text-white h-10 sm:h-12 px-2 sm:px-3 rounded-xl sm:rounded-full outline-none text-sm sm:text-base font-bold w-[50px] sm:w-[65px] text-center placeholder:text-slate-500 transition-colors ${activeModifier === 'the-dictator' ? 'opacity-50 cursor-not-allowed bg-red-900/40 text-red-400 border-red-500/50' : 'focus:border-slate-500/80 focus:bg-slate-800'}`}
            />

            <button 
              type="submit"
              disabled={
                (cueInput.trim().length === 0 && !cueInput.startsWith('data:image')) || 
                !isNumberValid() ||
                (activeModifier === 'oracle-riddle' && !isOracleRiddleValid()) ||
                (activeModifier === 'five-letter-curse' && !isFiveLetterCurseValid()) ||
                (activeModifier === 'boolean-search' && !isBooleanSearchValid()) ||
                (activeModifier === 'forced-acronym' && !isForcedAcronymValid()) ||
                cheatConflict !== null
              }
              className="h-10 sm:h-12 px-4 sm:px-6 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl sm:rounded-full transition-all shadow-lg shadow-emerald-500/20 active:scale-95 text-xs sm:text-sm flex items-center gap-1.5 uppercase tracking-wider whitespace-nowrap cursor-pointer"
            >
              <span>{t('give_clue_btn')}</span>
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </form>
        {activeModifier === 'oracle-riddle' && cueInput.trim().length > 0 && !isOracleRiddleValid() && (
          <div className="mt-2 text-[10px] sm:text-xs text-red-400 font-bold tracking-wide animate-pulse bg-slate-900/90 rounded-lg py-1 px-3 border border-red-500/30 shadow-lg text-center">
            {t('oracle_error')}
          </div>
        )}
        {activeModifier === 'five-letter-curse' && cueInput.trim().length > 0 && !isFiveLetterCurseValid() && (
          <div className="mt-2 text-[10px] sm:text-xs text-red-400 font-bold tracking-wide animate-pulse bg-slate-900/90 rounded-lg py-1 px-3 border border-red-500/30 shadow-lg text-center">
            {t('five_letter_error')}
          </div>
        )}
        {activeModifier === 'boolean-search' && cueInput.trim().length > 0 && !isBooleanSearchValid() && (
          <div className="mt-2 text-[10px] sm:text-xs text-red-400 font-bold tracking-wide animate-pulse bg-slate-900/90 rounded-lg py-1 px-3 border border-red-500/30 shadow-lg text-center">
            {t('boolean_error')}
          </div>
        )}
        {activeModifier === 'forced-acronym' && (
          <div className={`mt-2 text-[10px] sm:text-xs font-bold tracking-wide rounded-lg py-1 px-3 border shadow-lg text-center ${!isForcedAcronymValid() && cueInput.trim().length > 0 ? 'text-red-400 animate-pulse bg-slate-900/90 border-red-500/30' : 'text-slate-300 bg-slate-800/80 border-slate-600'}`}>
            {t('acronym_requirement')}: {modifierState?.acronym}
          </div>
        )}
        {activeModifier === 'the-dictator' && (
          <div className="mt-2 text-[10px] sm:text-xs text-red-400 font-black tracking-widest uppercase bg-slate-900/90 rounded-lg py-1 px-3 border border-red-500/50 shadow-lg text-center">
            {t('dictator_warning')}
          </div>
        )}
        {cheatConflict && (
          <div className="mt-2 text-[10px] sm:text-xs text-red-400 font-bold tracking-wide animate-pulse bg-slate-900/90 rounded-lg py-1 px-3 border border-red-500/50 shadow-lg text-center">
            ⚠️ {t('clue_conflict_warning')} ({cheatConflict})
          </div>
        )}
      </div>

      {showDrawingModal && (
        <DrawingModal 
          onClose={() => setShowDrawingModal(false)} 
          onSubmit={handleDrawingSubmit}
          initialImage={cueInput.startsWith('data:image') ? cueInput : undefined}
          onClear={() => setCueInput('')}
        />
      )}
    </>
  );
}
