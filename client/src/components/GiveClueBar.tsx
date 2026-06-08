import { useState, useEffect } from 'react';
import { PenTool, Send } from 'lucide-react';
import DrawingModal from './DrawingModal';
import { checkRhyme } from '../../../shared/modifiers';
import type { ClueType } from '../../../shared/types';

interface GiveClueBarProps {
  onSubmitCue: (cue: string, num: number) => void;
  clueType?: ClueType;
  activeModifier?: string | null;
  clueTargetCount?: number;
  isRTL?: boolean;
}

export default function GiveClueBar({
  onSubmitCue,
  clueType = 'both',
  activeModifier,
  clueTargetCount = 0,
  isRTL = false
}: GiveClueBarProps) {
  const [cueInput, setCueInput] = useState('');
  const [numInput, setNumInput] = useState<number | ''>('');
  const [showDrawingModal, setShowDrawingModal] = useState(false);

  useEffect(() => {
    if (clueTargetCount > 0) {
      setNumInput(clueTargetCount);
    }
  }, [clueTargetCount]);

  const isNumberValid = () => {
    if (numInput === '') return false;
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
      <div className="w-full shrink-0 max-w-3xl mx-auto mt-4 sm:mt-6 lg:mt-2 px-2 sm:px-4 animate-fade-in relative z-20">
        <form 
          onSubmit={handleSubmitCue} 
          className="bg-slate-800/95 backdrop-blur-md border border-slate-700/80 rounded-2xl sm:rounded-full p-2 flex items-center gap-2 shadow-2xl"
        >
          {clueType !== 'text' && (
            <button
              type="button"
              onClick={() => setShowDrawingModal(true)}
              className="p-2.5 sm:p-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl sm:rounded-full transition-colors flex-shrink-0 cursor-pointer"
              title="Draw a Clue"
            >
              <PenTool className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}

          {clueType !== 'doodle' && (
            <div className="flex-1 min-w-0 relative">
              <input 
                type="text" 
                placeholder={activeModifier === 'oracle-riddle' ? "Enter 2 rhyming words (e.g. red bed)..." : "Enter clue word..."}
                value={cueInput.startsWith('data:image') ? '[Doodle Clue Ready]' : cueInput}
                readOnly={cueInput.startsWith('data:image')}
                onChange={(e) => {
                  let val = e.target.value;
                  if (activeModifier === 'oracle-riddle') {
                    const cleanVal = val.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '');
                    const words = cleanVal.trim().split(/\s+/).filter(Boolean);
                    if (words.length > 2) {
                      return;
                    }
                    setCueInput(cleanVal);
                  } else {
                    setCueInput(val.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, ''));
                  }
                }}
                className="w-full bg-slate-900/80 border border-slate-700/50 focus:border-slate-500/80 text-white px-3.5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-full outline-none text-sm sm:text-base placeholder:text-slate-500 font-bold"
                maxLength={32}
              />
              {activeModifier === 'oracle-riddle' && cueInput.trim().length > 0 && !isOracleRiddleValid() && (
                <span className="absolute left-4 -bottom-6 text-[9px] sm:text-[10px] text-red-400 font-bold tracking-wide animate-pulse">
                  ⚠️ Must be exactly 2 rhyming words! (e.g. "red bed")
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <select 
              value={numInput} 
              onChange={(e) => setNumInput(e.target.value ? Number(e.target.value) : '')}
              className="bg-slate-900 border border-slate-700/50 text-white h-10 sm:h-12 px-3 rounded-xl sm:rounded-full outline-none text-sm sm:text-base font-bold cursor-pointer min-w-[50px] sm:min-w-[65px] text-center appearance-none"
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
                (activeModifier === 'oracle-riddle' && !isOracleRiddleValid())
              }
              className="h-10 sm:h-12 px-4 sm:px-6 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl sm:rounded-full transition-all shadow-lg shadow-emerald-500/20 active:scale-95 text-xs sm:text-sm flex items-center gap-1.5 uppercase tracking-wider whitespace-nowrap cursor-pointer"
            >
              <span>Give Clue</span>
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </form>
      </div>

      {showDrawingModal && (
        <DrawingModal onClose={() => setShowDrawingModal(false)} onSubmit={handleDrawingSubmit} />
      )}
    </>
  );
}
