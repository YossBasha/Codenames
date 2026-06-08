import { useState, useEffect } from 'react';
import { PenTool, Send } from 'lucide-react';
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
}

export default function GiveClueBar({
  onSubmitCue,
  clueType = 'both',
  activeModifier,
  clueTargetCount = 0,
  isRTL = false,
  modifierState
}: GiveClueBarProps) {
  const [cueInput, setCueInput] = useState('');
  const [numInput, setNumInput] = useState<number | ''>('');
  const [showDrawingModal, setShowDrawingModal] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (activeModifier === 'the-dictator' && modifierState?.forcedNumber !== undefined) {
      setNumInput(modifierState.forcedNumber);
    } else if (clueTargetCount > 0) {
      setNumInput(clueTargetCount);
    }
  }, [clueTargetCount, activeModifier, modifierState]);

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

  const handleSubmitCue = (e: React.FormEvent) => {
    e.preventDefault();
    if (cueInput.trim().length > 0 && numInput !== '' && onSubmitCue) {
      onSubmitCue(cueInput, Number(numInput));
      setCueInput('');
      setNumInput('');
    }
  };

  const handleDrawingSubmit = (dataUrl: string) => {
    if (numInput !== '' && onSubmitCue) {
      onSubmitCue(dataUrl, Number(numInput));
      setCueInput('');
      setNumInput('');
      setShowDrawingModal(false);
    } else {
      setCueInput(dataUrl);
      setShowDrawingModal(false);
    }
  };

  return (
    <>
      <div className="w-full shrink-0 max-w-3xl mx-auto mt-4 sm:mt-6 lg:mt-2 px-2 sm:px-4 animate-fade-in relative z-20 flex flex-col items-center">
        <form 
          onSubmit={handleSubmitCue} 
          className="w-full bg-slate-800/95 backdrop-blur-md border border-slate-700/80 rounded-2xl sm:rounded-full p-2 flex items-center gap-2 shadow-2xl"
        >
          {clueType !== 'text' && (
            <button
              type="button"
              onClick={() => setShowDrawingModal(true)}
              className="p-2.5 sm:p-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl sm:rounded-full transition-colors flex-shrink-0 cursor-pointer"
              title={t('draw_clue_title')}
            >
              <PenTool className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}

          {clueType !== 'doodle' && (
            <div className="flex-1 min-w-0 relative">
              <input 
                type="text" 
                placeholder={activeModifier === 'oracle-riddle' ? t('enter_rhyme_placeholder') : t('enter_clue_placeholder')}
                value={cueInput.startsWith('data:image') ? t('doodle_clue_ready') : cueInput}
                readOnly={cueInput.startsWith('data:image')}
                onChange={(e) => {
                  let val = e.target.value;
                  if (activeModifier === 'oracle-riddle' || activeModifier === 'boolean-search' || activeModifier === 'forced-acronym') {
                    const cleanVal = val.replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, '');
                    if (activeModifier === 'oracle-riddle') {
                      const words = cleanVal.trim().split(/\s+/).filter(Boolean);
                      if (words.length > 2) {
                        return;
                      }
                    } else if (activeModifier === 'forced-acronym') {
                      const words = cleanVal.trim().split(/\s+/).filter(Boolean);
                      if (words.length > (modifierState?.acronym?.split('-').length || 3)) {
                        return;
                      }
                    }
                    setCueInput(cleanVal);
                  } else {
                    setCueInput(val.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, ''));
                  }
                }}
                className="w-full bg-slate-900/80 border border-slate-700/50 focus:border-slate-500/80 text-white px-3.5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-full outline-none text-sm sm:text-base placeholder:text-slate-500 font-bold"
                maxLength={activeModifier === 'five-letter-curse' ? 5 : 32}
              />
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <select 
              value={numInput} 
              onChange={(e) => setNumInput(e.target.value ? Number(e.target.value) : '')}
              disabled={activeModifier === 'the-dictator'}
              className={`bg-slate-900 border border-slate-700/50 text-white h-10 sm:h-12 px-3 rounded-xl sm:rounded-full outline-none text-sm sm:text-base font-bold min-w-[50px] sm:min-w-[65px] text-center appearance-none ${activeModifier === 'the-dictator' ? 'opacity-50 cursor-not-allowed bg-red-900/40 text-red-400 border-red-500/50' : 'cursor-pointer'}`}
            >
              <option value="" disabled>-</option>
              {[0,1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
              <option value={99}>∞</option>
            </select>

            <button 
              type="submit"
              disabled={
                cueInput.trim().length === 0 || 
                !isNumberValid() ||
                (activeModifier === 'oracle-riddle' && !isOracleRiddleValid()) ||
                (activeModifier === 'five-letter-curse' && !isFiveLetterCurseValid()) ||
                (activeModifier === 'boolean-search' && !isBooleanSearchValid()) ||
                (activeModifier === 'forced-acronym' && !isForcedAcronymValid())
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
      </div>

      {showDrawingModal && (
        <DrawingModal onClose={() => setShowDrawingModal(false)} onSubmit={handleDrawingSubmit} />
      )}
    </>
  );
}
