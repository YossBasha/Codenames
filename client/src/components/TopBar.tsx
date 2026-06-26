import { useState, useEffect, useRef } from 'react';
import type { Team, ClueType } from '../../../shared/types';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../utils';
import { MODIFIERS } from '../../../shared/modifiers';
import { MODIFIER_ICONS } from './GameSettingsPanel';
import { useI18n } from '../context/I18nContext';

interface TopBarProps {
  redScore: number;
  blueScore: number;
  currentTurn: Team;
  currentPhase: 'spymaster' | 'operative';
  playerTeam?: Team;
  playerRole?: string;
  gameMode?: 'classic' | 'duet';
  timerTokens?: number;
  remainingGreens?: number;
  timeRemaining?: number;
  isTimerEnabled?: boolean;
  onSubmitCue?: (cue: string, num: number) => void;
  showSpymasterToggle?: boolean;
  onToggleSpymaster?: () => void;
  isSpymaster?: boolean;
  clueTargetCount?: number;
  amHost?: boolean;
  onRestartGame?: () => void;
  clueType?: ClueType;
  activeModifier?: string | null;
  isRTL?: boolean;
  onLeave?: () => void;
}

export default function TopBar({
  redScore,
  blueScore,
  currentTurn,
  currentPhase,
  playerTeam,
  playerRole,
  gameMode = 'classic',
  timerTokens = 9,
  remainingGreens,
  timeRemaining = 0,
  isTimerEnabled = false,
  showSpymasterToggle,
  onToggleSpymaster,
  isSpymaster,
  amHost = false,
  onRestartGame,
  activeModifier,
  onLeave
}: TopBarProps) {
  const navigate = useNavigate();
  const { t, uiLanguage } = useI18n();
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setShowTooltip(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const isActiveSpymaster = currentPhase === 'spymaster' && (
    (gameMode === 'classic' && playerTeam === currentTurn && playerRole === 'spymaster') ||
    (gameMode === 'duet' && playerTeam === currentTurn)
  );

  return (
    <div className="relative z-50 w-full shrink-0 flex flex-row items-center justify-between py-2 px-2.5 sm:py-3 sm:px-4 bg-slate-900/50 backdrop-blur-md shadow-md gap-2 sm:gap-4">
      <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
        <button 
          onClick={() => {
            if (onLeave) {
              onLeave();
            } else {
              navigate('/');
            }
          }}
          className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 p-1 sm:p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer z-10"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </button>
        {gameMode === 'classic' ? (
          <div className="flex items-center gap-2 sm:gap-4 bg-slate-800/80 rounded-xl p-1 sm:p-1.5 font-black text-xs sm:text-sm shadow-inner ring-1 ring-white/5 rtl:mr-8 ltr:ml-8 sm:rtl:mr-10 sm:ltr:ml-10">
            <div className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-md transition-all duration-300 ${currentTurn === 'red' ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/40 scale-105 sm:scale-110 ring-1 ring-red-400/50' : 'text-red-500 hover:bg-red-500/10'}`}>
              {redScore}
            </div>
            <span className="text-slate-500 font-medium">-</span>
            <div className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-md transition-all duration-300 ${currentTurn === 'blue' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/40 scale-105 sm:scale-110 ring-1 ring-blue-400/50' : 'text-blue-500 hover:bg-blue-500/10'}`}>
              {blueScore}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-800 rounded-lg p-1 sm:p-1.5 font-bold text-xs sm:text-sm text-lime-400 rtl:mr-8 ltr:ml-8 sm:rtl:mr-10 sm:ltr:ml-10">
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-lime-500 shadow-[0_0_10px_#84cc16]"></div>
            <span className="whitespace-nowrap">
              {remainingGreens !== undefined ? t('green_tokens').replace('{count}', remainingGreens.toString()) : t('tokens_count').replace('{count}', timerTokens.toString())}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 lg:flex-none lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 flex items-center justify-center pointer-events-none z-10 min-w-0 px-1 sm:px-2">
        <div className="relative pointer-events-auto flex flex-row lg:flex-col items-center justify-center gap-1.5 sm:gap-3 lg:gap-0 leading-none min-w-0 w-full lg:w-auto">
          
          {/* Timer (Flows inline on mobile, absolutely positioned on desktop) */}
          {isTimerEnabled && (
            <div className="lg:absolute lg:right-full lg:mr-3 sm:lg:mr-4 lg:top-1/2 lg:-translate-y-1/2 text-xs xs:text-sm sm:text-lg lg:text-xl font-black text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)] tabular-nums whitespace-nowrap shrink-0">
              {timeRemaining}s
            </div>
          )}

          {/* Centered Turn and Role Info */}
          <div className="flex flex-col items-center justify-center shrink min-w-0">
            <div className="text-[10px] xs:text-xs sm:text-base lg:text-lg font-black tracking-tight truncate max-w-full">
              {gameMode === 'classic' ? (
                <span className={cn(
                  "transition-colors duration-300",
                  currentTurn === 'red' ? 'text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-rose-600' : 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600'
                )}>
                  {currentTurn === 'red' ? t('red_team_turn') : t('blue_team_turn')}
                </span>
              ) : (
                <>
                  <span className={currentTurn === 'red' ? 'text-lime-400' : 'text-green-400'}>
                    {currentTurn === 'red' ? t('side_a') : t('side_b')}
                  </span>
                  <span className="hidden sm:inline"> {t('gives_clue')}</span>
                </>
              )}
            </div>
            {gameMode !== 'duet' && (
              <div className="text-[6px] xs:text-[7px] sm:text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest whitespace-nowrap truncate max-w-full">
                {currentPhase === 'spymaster' ? t('spymaster_role_label') : t('operative_role_label')}
              </div>
            )}
          </div>

          {/* Active Modifier (Flows inline on mobile, absolutely positioned on desktop) */}
          {activeModifier && (() => {
            const mod = MODIFIERS.find(m => m.id === activeModifier);
            if (!mod) return null;
            const IconComponent = MODIFIER_ICONS[mod.icon] || MODIFIER_ICONS['HelpCircle'];
            return (
              <div 
                ref={tooltipRef}
                className="lg:absolute lg:left-full lg:ml-3 sm:lg:ml-4 lg:top-1/2 lg:-translate-y-1/2 group cursor-pointer z-50 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTooltip(!showTooltip);
                }}
              >
                <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 transition-all rounded-full px-1.5 py-0.5 sm:px-2 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                  <IconComponent className="w-3 h-3 sm:w-4 sm:h-4 text-red-400 shrink-0" />
                  <span className="hidden xs:inline text-[6px] sm:text-[9px] font-black tracking-widest text-red-400 uppercase truncate max-w-[60px] sm:max-w-none">{mod.name}</span>
                </div>
                
                <div className={cn(
                  "absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 sm:w-64 bg-slate-950/95 border border-red-500/30 rounded-2xl p-3 sm:p-4 shadow-2xl transition-opacity duration-200 z-50",
                  showTooltip 
                    ? "opacity-100 pointer-events-auto" 
                    : "pointer-events-none opacity-0 group-hover:opacity-100"
                )}>
                  <div className="flex items-center gap-2 mb-2 text-red-400">
                    <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
                    <h4 className="font-black tracking-wider text-[10px] sm:text-xs uppercase">{uiLanguage === 'ar' ? mod.nameAr || mod.name : mod.name}</h4>
                  </div>
                  <p className="text-[9px] sm:text-[11px] font-bold text-slate-300 leading-normal">{uiLanguage === 'ar' ? mod.descriptionAr || mod.description : mod.description}</p>
                  <div className="mt-2 pt-2 border-t border-white/5 text-[7px] sm:text-[9px] font-black text-slate-500 tracking-wider uppercase text-center">
                    {t('category_label')} {uiLanguage === 'ar' ? mod.categoryAr || mod.category : mod.category}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-3 shrink-0 rtl:pl-8 sm:rtl:pl-12">
        {amHost && (
          <button
            onClick={onRestartGame}
            className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-lg shadow-amber-600/20 whitespace-nowrap text-[10px] sm:text-xs cursor-pointer"
          >
            {t('new_game')}
          </button>
        )}
        {isActiveSpymaster ? (
          <div className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 font-bold rounded-lg text-[9px] sm:text-xs whitespace-nowrap animate-pulse">
            {t('giving_clue_status')}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2">
            {showSpymasterToggle && (
              <button
                onClick={onToggleSpymaster}
                className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg font-bold transition-all text-[10px] sm:text-xs cursor-pointer ${
                  isSpymaster 
                    ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/50' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600'
                }`}
              >
                {isSpymaster ? t('hide_spymaster_view') : t('spymaster_view')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
