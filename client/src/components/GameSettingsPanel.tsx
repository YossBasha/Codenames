import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  BookOpen, Clock, X, Globe, Check, Keyboard, Upload, Volume2, VolumeX, PenTool,
  Binary, FileText, HelpCircle, EyeOff, Shuffle, Ghost, Wind, Zap, HeartHandshake, Dices, Shield, WifiOff, Flame, Type, Eye,
  Skull, Gift, Swords, FastForward, Activity, Scissors, Copy, Crosshair, Terminal, SpellCheck, CaseUpper, Lock, MousePointer2, Timer, Palette, CloudFog,
  UserMinus, Cookie
} from 'lucide-react';
import { cn } from '../utils';
import type { Language, CustomWordWeight, TimerSettings, ClueType } from '../../../shared/types';
import { useGameContext } from '../context/GameContext';
import { useI18n } from '../context/I18nContext';
import { MODIFIERS } from '../../../shared/modifiers';

export const MODIFIER_ICONS: Record<string, React.ComponentType<any>> = {
  'Binary': Binary,
  'FileText': FileText,
  'HelpCircle': HelpCircle,
  'EyeOff': EyeOff,
  'Shuffle': Shuffle,
  'Ghost': Ghost,
  'Wind': Wind,
  'Zap': Zap,
  'HeartHandshake': HeartHandshake,
  'Dices': Dices,
  'Shield': Shield,
  'WifiOff': WifiOff,
  'Flame': Flame,
  'Type': Type,
  'Eye': Eye,
  'Skull': Skull,
  'Gift': Gift,
  'Swords': Swords,
  'FastForward': FastForward,
  'Activity': Activity,
  'Scissors': Scissors,
  'Copy': Copy,
  'Crosshair': Crosshair,
  'Terminal': Terminal,
  'SpellCheck': SpellCheck,
  'CaseUpper': CaseUpper,
  'Lock': Lock,
  'MousePointer2': MousePointer2,
  'Timer': Timer,
  'Palette': Palette,
  'CloudFog': CloudFog,
  'Globe': Globe,
  'UserMinus': UserMinus,
  'Cookie': Cookie
};

interface GameSettingsPanelProps {
  isHost: boolean;
  gameMode: 'classic' | 'duet';
  setGameMode: (mode: 'classic' | 'duet') => void;
  selectedPacks: string[];
  setSelectedPacks: React.Dispatch<React.SetStateAction<string[]>>;
  timerSettings: TimerSettings;
  setTimerSettings: React.Dispatch<React.SetStateAction<TimerSettings>>;
  customWordsText: string;
  setCustomWordsText: (text: string) => void;
  customWordWeight: CustomWordWeight;
  setCustomWordWeight: (weight: CustomWordWeight) => void;
  customWordsArray: string[];
  language: Language;
  setLanguage: (lang: Language) => void;
  clueType: ClueType;
  setClueType: (clueType: ClueType) => void;
  chaosMode: boolean;
  setChaosMode: (val: boolean) => void;
  enabledModifiers?: string[];
  setEnabledModifiers?: (modifiers: string[]) => void;
}

export default function GameSettingsPanel({
  isHost,
  gameMode,
  setGameMode,
  selectedPacks,
  setSelectedPacks,
  timerSettings,
  setTimerSettings,
  customWordsText,
  setCustomWordsText,
  customWordWeight,
  setCustomWordWeight,
  customWordsArray,
  language,
  setLanguage,
  clueType,
  setClueType,
  chaosMode,
  setChaosMode,
  enabledModifiers = [],
  setEnabledModifiers
}: GameSettingsPanelProps) {
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [showWordPacksModal, setShowWordPacksModal] = useState(false);
  const [showClueModal, setShowClueModal] = useState(false);
  const [showChaosModal, setShowChaosModal] = useState(false);
  const [customWordsTab, setCustomWordsTab] = useState<'type'|'upload'>('type');
  
  const { volume, setVolume } = useGameContext();
  const { t, uiLanguage } = useI18n();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) setCustomWordsText(text);
    };
    reader.readAsText(file);
  };

  const handlePresetChange = (preset: 'off' | 'quick' | 'relaxed' | 'custom') => {
    if (preset === 'off') {
      setTimerSettings({ preset, spymasterTime: 0, operativeTime: 0, extraFirstClueTime: 0 });
      if (enabledModifiers?.includes('critical-hit') && setEnabledModifiers) {
        setEnabledModifiers(enabledModifiers.filter(id => id !== 'critical-hit'));
      }
    } else {
      if (timerSettings.preset === 'off' && enabledModifiers && setEnabledModifiers && !enabledModifiers.includes('critical-hit')) {
        setEnabledModifiers([...enabledModifiers, 'critical-hit']);
      }
      if (preset === 'quick') {
        setTimerSettings({ preset, spymasterTime: 90, operativeTime: 60, extraFirstClueTime: 60 });
      } else if (preset === 'relaxed') {
        setTimerSettings({ preset, spymasterTime: 180, operativeTime: 120, extraFirstClueTime: 120 });
      } else {
        setTimerSettings(prev => ({ ...prev, preset }));
      }
    }
  };

  useEffect(() => {
    if (!setEnabledModifiers || !enabledModifiers) return;
    
    let updated = [...enabledModifiers];
    let changed = false;

    // Language 'all' forbids lost-in-translation
    if (language === 'all' && updated.includes('lost-in-translation')) {
      updated = updated.filter(id => id !== 'lost-in-translation');
      changed = true;
    }

    // Doodle only forbids text-based clue modifiers
    if (clueType === 'doodle') {
      const forbidden = ['vowel-void', 'five-letter-curse', 'boolean-search', 'oracle-riddle'];
      const filtered = updated.filter(id => !forbidden.includes(id));
      if (filtered.length !== updated.length) {
        updated = filtered;
        changed = true;
      }
    }

    // Emoji pack forbids translation/censorship on emoji symbols
    if (selectedPacks.includes('emojis')) {
      const forbidden = ['lost-in-translation', 'censored-documents'];
      const filtered = updated.filter(id => !forbidden.includes(id));
      if (filtered.length !== updated.length) {
        updated = filtered;
        changed = true;
      }
    }

    // Duet mode forbids colorblind and the-intercept
    if (gameMode === 'duet') {
      const forbidden = ['colorblind', 'the-intercept'];
      const filtered = updated.filter(id => !forbidden.includes(id));
      if (filtered.length !== updated.length) {
        updated = filtered;
        changed = true;
      }
    }

    // Timer off forbids critical-hit
    if (timerSettings.preset === 'off' && updated.includes('critical-hit')) {
      updated = updated.filter(id => id !== 'critical-hit');
      changed = true;
    }

    // Custom words forbid lost-in-translation
    if (customWordsArray && customWordsArray.length > 0 && updated.includes('lost-in-translation')) {
      updated = updated.filter(id => id !== 'lost-in-translation');
      changed = true;
    }

    if (changed) {
      setEnabledModifiers(updated);
    }
  }, [
    clueType,
    selectedPacks,
    language,
    gameMode,
    timerSettings.preset,
    enabledModifiers,
    setEnabledModifiers,
    customWordsArray
  ]);

  return (
    <>
      <div className="flex flex-col gap-2.5 flex-1">
        <div className="grid grid-cols-2 gap-2.5">
          <button 
            onClick={() => isHost && setGameMode('classic')}
            className={cn("flex items-center justify-center gap-2 rounded-2xl py-2 border-b-4 transition-all", 
              gameMode === 'classic' ? "bg-[#0ea5e9] border-blue-700 cursor-default" : "bg-[#333] border-[#222] opacity-50 hover:opacity-80"
            )}
          >
            <div className="text-center">
              <div className="font-black text-base lg:text-lg tracking-wider">{t('classic_mode')}</div>
              <div className="text-[10px] opacity-80">{t('players_4_plus')}</div>
            </div>
          </button>
          <button 
            onClick={() => isHost && setGameMode('duet')}
            className={cn("flex items-center justify-center gap-2 rounded-2xl py-2 border-b-4 transition-all", 
              gameMode === 'duet' ? "bg-green-600 border-green-800 cursor-default" : "bg-[#333] border-[#222] opacity-50 hover:opacity-80"
            )}
          >
            <div className="text-center">
              <div className="font-black text-base lg:text-lg tracking-wider">{t('duet_mode')}</div>
              <div className="text-[10px] opacity-80">{t('players_2_plus')}</div>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 h-full">
          <button 
            onClick={() => setShowWordPacksModal(true)}
            className={cn("flex flex-col items-center justify-center gap-1 rounded-2xl p-2 border transition-all h-full min-h-[72px]", 
              "bg-[#333] border-[#444] hover:border-indigo-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]"
            )}
          >
            <div className="p-1.5 rounded-full bg-indigo-500 text-white">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="text-center">
              <div className="font-black text-sm lg:text-base tracking-widest text-white">{t('word_packs')}</div>
              <div className="text-[10px] font-bold text-slate-400 leading-tight">
                {t('packs_count').replace('{lang}', language === 'all' ? 'ALL' : language.toUpperCase()).replace('{count}', selectedPacks.length.toString())}
                {customWordsArray.length > 0 && t('custom_words_weight').replace('{weight}', customWordWeight)}
              </div>
            </div>
          </button>

          <button 
            onClick={() => setShowTimerModal(true)}
            className={cn("flex flex-col items-center justify-center gap-1 rounded-2xl p-2 border transition-all h-full min-h-[72px]", 
              timerSettings.preset !== 'off' ? "bg-[#333] border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]" : "bg-[#333] border-[#444] opacity-80 hover:opacity-100"
            )}
          >
            <div className={cn("p-1.5 rounded-full text-white", timerSettings.preset !== 'off' ? "bg-orange-500" : "bg-slate-600")}>
              <Clock className="w-5 h-5" />
            </div>
            <div className="text-center">
              <div className="font-black text-sm lg:text-base tracking-widest text-white">{t('timer_label')}</div>
              <div className="text-[10px] font-bold text-slate-400 tracking-wider leading-tight">
                {timerSettings.preset === 'off' ? 'OFF' : timerSettings.preset.toUpperCase()}
              </div>
            </div>
          </button>

          <button 
            onClick={() => setShowClueModal(true)}
            className={cn("flex flex-col items-center justify-center gap-1 rounded-2xl p-2 border transition-all h-full min-h-[72px]", 
              clueType !== 'text' ? "bg-[#333] border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "bg-[#333] border-[#444] hover:border-emerald-500"
            )}
          >
            <div className={cn("p-1.5 rounded-full text-white", clueType !== 'text' ? "bg-emerald-500" : "bg-slate-600")}>
              <PenTool className="w-5 h-5" />
            </div>
            <div className="text-center">
              <div className="font-black text-sm lg:text-base tracking-widest text-white">{t('clues_label')}</div>
              <div className="text-[10px] font-bold text-slate-400 tracking-wider leading-tight">
                {clueType === 'both' ? t('text_and_doodles') : clueType === 'doodle' ? t('doodles_only') : t('text_only')}
              </div>
            </div>
          </button>
        </div>
        <div className="bg-[#2a2a2a] rounded-2xl p-2.5 border border-[#444] shadow-inner mt-1.5 flex items-center gap-2.5" dir="ltr">
          <div className="p-1.5 rounded-full bg-slate-700 text-white flex-shrink-0">
            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider">{t('sfx_volume')}</span>
              <span className="text-[10px] font-mono font-bold text-slate-300">{Math.round(volume * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 h-1.5 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Chaos Mode Toggle */}
        <div className={cn(
          "bg-[#2a2a2a] rounded-2xl p-2.5 border transition-all mt-1.5 flex flex-col gap-2.5",
          chaosMode ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)] bg-red-950/10" : "border-[#444]"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-1.5 rounded-full text-white", chaosMode ? "bg-red-500" : "bg-slate-600")}>
                <span className="text-xs font-bold">🌀</span>
              </div>
              <div className="text-left">
                <span className="block text-xs font-black tracking-widest text-white uppercase leading-none">{t('chaos_mode_title')}</span>
                <span className="block text-[9px] font-bold text-slate-400 mt-1 leading-tight">{t('chaos_mode_desc')}</span>
              </div>
            </div>
            <label className={cn("relative inline-flex items-center group", isHost ? "cursor-pointer" : "opacity-50 cursor-not-allowed")}>
              <input 
                type="checkbox" 
                checked={chaosMode} 
                disabled={!isHost}
                onChange={(e) => setChaosMode(e.target.checked)} 
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
            </label>
          </div>

          {chaosMode && (
            <button
              onClick={() => setShowChaosModal(true)}
              className="w-full py-1.5 bg-red-950/40 hover:bg-red-900/30 border border-red-500/30 rounded-xl font-bold tracking-wider text-[10px] text-red-400 hover:text-red-300 transition-colors flex items-center justify-center gap-1.5"
            >
              <span>{t('configure_events')}</span>
              <span className="px-1.5 py-0.5 bg-red-500/20 text-red-300 text-[8px] font-black rounded-md leading-none" dir="ltr">
                {enabledModifiers.length} / {MODIFIERS.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {showWordPacksModal && createPortal(
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-xl p-6 border-2 border-slate-700 shadow-2xl relative my-8">
            <button 
              onClick={() => setShowWordPacksModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="bg-indigo-500 p-3 rounded-full text-white">
                <BookOpen className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-widest text-white">{t('word_settings_title')}</h2>
                <p className="text-sm font-bold text-slate-400">{t('word_settings_desc')}</p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="bg-[#2a2a2a] rounded-2xl p-4 border border-[#333] flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#444] p-2 rounded-lg text-white">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div className="font-black tracking-widest text-sm text-white">{t('language_label')}</div>
                  </div>
                  
                  <select
                    value={language}
                    onChange={(e) => isHost && setLanguage(e.target.value as Language)}
                    disabled={!isHost}
                    className="bg-[#222] text-white px-3 py-2 rounded-xl border-2 border-slate-700 outline-none text-xs font-black tracking-wider cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:border-indigo-500 transition-colors"
                  >
                    {(['all', 'en', 'ar', 'du', 'ge', 'fr', 'es'] as Language[]).map(lang => {
                      const isDisabledLang = lang === 'all' && enabledModifiers?.includes('lost-in-translation');
                      let displayName = lang.toUpperCase();
                      if (lang === 'all') displayName = 'ALL';
                      else if (lang === 'du') displayName = 'DUTCH';
                      else if (lang === 'ge') displayName = 'GERMAN';
                      else if (lang === 'fr') displayName = 'FRENCH';
                      else if (lang === 'es') displayName = 'SPANISH';
                      return (
                        <option 
                          key={lang} 
                          value={lang} 
                          disabled={isDisabledLang}
                          className="bg-[#1a1a1a] text-white font-bold"
                        >
                          {displayName}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className={cn("flex items-center gap-3 group bg-[#222] p-3 rounded-xl border border-[#444] transition-colors", isHost ? "cursor-pointer hover:border-indigo-500" : "opacity-70 cursor-not-allowed")}>
                    <div className={cn("w-5 h-5 rounded flex items-center justify-center border transition-colors", selectedPacks.includes('classic') ? "bg-indigo-500 border-indigo-500" : "border-slate-500")}>
                      {selectedPacks.includes('classic') && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={selectedPacks.includes('classic')} onChange={() => isHost && setSelectedPacks(prev => prev.includes('classic') ? prev.filter(p => p !== 'classic') : [...prev, 'classic'])} disabled={!isHost} />
                    <span className="text-sm font-bold text-slate-300">{t('base_pack')}</span>
                  </label>
                  <label className={cn("flex items-center gap-3 group bg-[#222] p-3 rounded-xl border border-[#444] transition-colors", isHost ? "cursor-pointer hover:border-indigo-500" : "opacity-70 cursor-not-allowed")}>
                    <div className={cn("w-5 h-5 rounded flex items-center justify-center border transition-colors", selectedPacks.includes('duet') ? "bg-indigo-500 border-indigo-500" : "border-slate-500")}>
                      {selectedPacks.includes('duet') && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={selectedPacks.includes('duet')} onChange={() => isHost && setSelectedPacks(prev => prev.includes('duet') ? prev.filter(p => p !== 'duet') : [...prev, 'duet'])} disabled={!isHost} />
                    <span className="text-sm font-bold text-slate-300">{t('duet_pack')}</span>
                  </label>
                  <label className={cn("flex items-center gap-3 group bg-[#222] p-3 rounded-xl border border-[#444] transition-colors", isHost ? "cursor-pointer hover:border-indigo-500" : "opacity-70 cursor-not-allowed")}>
                    <div className={cn("w-5 h-5 rounded flex items-center justify-center border transition-colors", selectedPacks.includes('emojis') ? "bg-indigo-500 border-indigo-500" : "border-slate-500")}>
                      {selectedPacks.includes('emojis') && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={selectedPacks.includes('emojis')} onChange={() => isHost && setSelectedPacks(prev => prev.includes('emojis') ? prev.filter(p => p !== 'emojis') : [...prev, 'emojis'])} disabled={!isHost} />
                    <span className="text-sm font-bold text-slate-300">{t('emojis_pack')}</span>
                  </label>
                </div>
              </div>

              <div className="bg-[#2a2a2a] rounded-2xl p-4 border border-[#333] flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500 p-2 rounded-lg text-white">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-black tracking-widest text-sm text-white">{t('custom_words_title')}</div>
                      <div className="text-xs text-emerald-400 font-bold">{t('unique_words_count').replace('{count}', customWordsArray.length.toString())}</div>
                    </div>
                  </div>

                  <div className="flex bg-[#222] p-1 rounded-lg border border-[#444]">
                    <button
                      onClick={() => isHost && setCustomWordsTab('type')}
                      disabled={!isHost}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-colors",
                        customWordsTab === 'type' ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white",
                        !isHost && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Keyboard className="w-3.5 h-3.5" /> {t('type_words')}
                    </button>
                    <button
                      onClick={() => isHost && setCustomWordsTab('upload')}
                      disabled={!isHost}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-colors",
                        customWordsTab === 'upload' ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white",
                        !isHost && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Upload className="w-3.5 h-3.5" /> {t('upload_file')}
                    </button>
                  </div>
                </div>

                {customWordsTab === 'type' ? (
                  <textarea
                    value={customWordsText}
                    onChange={(e) => setCustomWordsText(e.target.value)}
                    disabled={!isHost}
                    placeholder={t('type_words_placeholder')}
                    className="w-full h-32 bg-[#222] border border-[#444] rounded-xl p-3 text-sm font-mono text-white focus:border-emerald-500 outline-none resize-none disabled:opacity-50"
                  />
                ) : (
                  <div className={cn("w-full h-32 bg-[#222] border-2 border-dashed border-[#444] rounded-xl flex flex-col items-center justify-center gap-2 relative transition-colors", isHost ? "hover:border-emerald-500" : "opacity-50")}>
                    <Upload className="w-8 h-8 text-slate-500" />
                    <div className="text-sm font-bold text-slate-400">{t('drag_drop_file')}</div>
                    <input
                      type="file"
                      accept=".txt,.csv"
                      onChange={handleFileUpload}
                      disabled={!isHost}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex justify-between text-xs font-bold text-slate-400">
                    <span>{t('custom_words_ratio')}</span>
                    <span className="text-emerald-400 uppercase">{customWordWeight}</span>
                  </div>
                  <div className="flex bg-[#222] p-1 rounded-lg border border-[#444]">
                    {(['none', 'few', 'some', 'many'] as CustomWordWeight[]).map(weight => (
                      <button
                        key={weight}
                        onClick={() => isHost && setCustomWordWeight(weight)}
                        disabled={!isHost}
                        className={cn(
                          "flex-1 py-1.5 rounded-md text-xs font-black uppercase transition-colors",
                          customWordWeight === weight ? "bg-slate-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300",
                          !isHost && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {weight}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowWordPacksModal(false)}
              className="mt-8 w-full py-3 bg-indigo-500 hover:bg-indigo-400 rounded-xl font-black tracking-widest text-white shadow-lg transition-colors"
            >
              {t('done_btn')}
            </button>
          </div>
        </div>,
        document.body
      )}

      {showTimerModal && createPortal(
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-md p-6 border-2 border-slate-700 shadow-2xl relative">
            <button 
              onClick={() => setShowTimerModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="flex items-center gap-4 mb-8">
              <div className="bg-orange-500 p-3 rounded-full text-white">
                <Clock className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-widest text-white">{t('timer_settings')}</h2>
                <p className="text-sm font-bold text-slate-400">{t('timer_settings_desc')}</p>
              </div>
            </div>

            <div className="flex bg-[#2a2a2a] rounded-xl p-1 mb-8 shadow-inner">
              {['off', 'quick', 'relaxed', 'custom'].map(preset => (
                <button
                  key={preset}
                  onClick={() => isHost && handlePresetChange(preset as any)}
                  disabled={!isHost}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-bold tracking-wider transition-all",
                    timerSettings.preset === preset ? "bg-slate-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200",
                    !isHost && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {t(`timer_${preset}` as any).toUpperCase()}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between bg-[#2a2a2a] p-4 rounded-2xl border border-[#333]">
                <div className="text-left">
                  <div className="font-bold text-white tracking-wider">{t('spymaster_turn')}</div>
                  <div className="text-xs text-slate-400">{t('spymaster_turn_desc')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    value={timerSettings.spymasterTime}
                    disabled={!isHost || timerSettings.preset !== 'custom'}
                    onChange={e => setTimerSettings(p => ({ ...p, spymasterTime: Number(e.target.value) }))}
                    className="w-16 bg-[#111] border border-slate-700 rounded p-2 text-center font-mono font-bold text-white disabled:opacity-50"
                  />
                  <span className="text-slate-500 font-bold text-xs">{t('sec_label')}</span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#2a2a2a] p-4 rounded-2xl border border-[#333]">
                <div className="text-left">
                  <div className="font-bold text-white tracking-wider">{t('operative_turn')}</div>
                  <div className="text-xs text-slate-400">{t('operative_turn_desc')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    value={timerSettings.operativeTime}
                    disabled={!isHost || timerSettings.preset !== 'custom'}
                    onChange={e => setTimerSettings(p => ({ ...p, operativeTime: Number(e.target.value) }))}
                    className="w-16 bg-[#111] border border-slate-700 rounded p-2 text-center font-mono font-bold text-white disabled:opacity-50"
                  />
                  <span className="text-slate-500 font-bold text-xs">{t('sec_label')}</span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#2a2a2a] p-4 rounded-2xl border border-[#333]">
                <div className="text-left">
                  <div className="font-bold text-white tracking-wider">{t('first_clue_bonus')}</div>
                  <div className="text-xs text-slate-400">{t('first_clue_bonus_desc')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    value={timerSettings.extraFirstClueTime}
                    disabled={!isHost || timerSettings.preset !== 'custom'}
                    onChange={e => setTimerSettings(p => ({ ...p, extraFirstClueTime: Number(e.target.value) }))}
                    className="w-16 bg-[#111] border border-slate-700 rounded p-2 text-center font-mono font-bold text-white disabled:opacity-50"
                  />
                  <span className="text-slate-500 font-bold text-xs">{t('sec_label')}</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setShowTimerModal(false)}
              className="mt-8 w-full py-3 bg-orange-500 hover:bg-orange-400 rounded-xl font-black tracking-widest text-white shadow-lg transition-colors"
            >
              {t('done_btn')}
            </button>
          </div>
        </div>,
        document.body
      )}
      {showClueModal && createPortal(
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-md p-6 border-2 border-slate-700 shadow-2xl relative">
            <button 
              onClick={() => setShowClueModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="flex items-center gap-4 mb-8">
              <div className="bg-emerald-500 p-3 rounded-full text-white">
                <PenTool className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-widest text-white">{t('clue_type')}</h2>
                <p className="text-sm font-bold text-slate-400">{t('clue_type_desc')}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {[
                { type: 'both', label: t('text_and_doodles'), desc: t('clue_text_doodle_desc') },
                { type: 'text', label: t('text_only'), desc: t('clue_text_desc') },
                { type: 'doodle', label: t('doodles_only'), desc: t('clue_doodle_desc') }
              ].map(opt => (
                <button
                  key={opt.type}
                  onClick={() => isHost && setClueType(opt.type as ClueType)}
                  disabled={!isHost}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between",
                    clueType === opt.type 
                      ? "bg-slate-800 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                      : "bg-[#222] border-[#333] hover:border-slate-500",
                    !isHost && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div>
                    <div className="font-black tracking-widest text-white uppercase mb-1">{opt.label}</div>
                    <div className="text-xs text-slate-400 font-bold">{opt.desc}</div>
                  </div>
                  {clueType === opt.type && <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setShowClueModal(false)}
              className="mt-8 w-full py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-black tracking-widest text-white shadow-lg transition-colors"
            >
              {t('done_btn')}
            </button>
          </div>
        </div>,
        document.body
      )}

      {showChaosModal && createPortal(
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-2xl p-6 border-2 border-red-500/50 shadow-2xl relative flex flex-col max-h-[85vh]">
            <button 
              onClick={() => setShowChaosModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors z-10"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="flex items-center gap-4 mb-4">
              <div className="bg-red-500 p-3 rounded-full text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                <span className="text-xl font-bold leading-none">🌀</span>
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-widest text-white">{t('chaos_events_title')}</h2>
                <p className="text-xs font-bold text-slate-400">{t('chaos_events_desc')}</p>
              </div>
            </div>

            {/* Quick Actions (Select/Deselect All) */}
            {isHost && (
              <div className="flex gap-3 mb-4 shrink-0">
                <button
                  onClick={() => setEnabledModifiers?.(MODIFIERS.filter(m => {
                    if (m.id === 'critical-hit' && timerSettings.preset === 'off') return false;
                    if ((m.id === 'colorblind' || m.id === 'the-intercept') && gameMode === 'duet') return false;
                    if (m.id === 'lost-in-translation' && language === 'all') return false;
                    return true;
                  }).map(m => m.id))}
                  className="px-4 py-1.5 bg-[#333] hover:bg-[#444] border border-[#555] rounded-xl text-xs font-black tracking-wider text-slate-200 transition-all"
                >
                  {t('select_all')}
                </button>
                <button
                  onClick={() => setEnabledModifiers?.([])}
                  className="px-4 py-1.5 bg-[#333] hover:bg-[#444] border border-[#555] rounded-xl text-xs font-black tracking-wider text-slate-200 transition-all"
                >
                  {t('deselect_all')}
                </button>
              </div>
            )}

            {/* Modifiers List grouped by category */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-5 scrollbar-thin bg-[#1a1a1a] [transform:translateZ(0)] will-change-transform">
              {(['spymaster', 'board', 'guesser'] as const).map(category => {
                const categoryModifiers = MODIFIERS.filter(m => m.category === category);
                const categoryTitle = category === 'spymaster' 
                  ? t('spymaster_modifiers')
                  : category === 'board' 
                    ? t('board_modifiers')
                    : t('guesser_modifiers');
                const categoryColor = category === 'spymaster' 
                  ? 'border-indigo-500/30 text-indigo-400 bg-indigo-500/5' 
                  : category === 'board' 
                    ? 'border-amber-500/30 text-amber-400 bg-amber-500/5' 
                    : 'border-rose-500/30 text-rose-400 bg-rose-500/5';
                
                return (
                  <div key={category} className="space-y-2.5">
                    <div className={cn("px-3 py-1.5 border rounded-xl font-black text-[10px] tracking-widest leading-none w-max uppercase", categoryColor)}>
                      {categoryTitle}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {categoryModifiers.map(mod => {
                        const isTimerRequired = mod.id === 'critical-hit';
                        const isTimerOff = timerSettings.preset === 'off';
                        
                        const isDuetForbidden = mod.id === 'colorblind' || mod.id === 'the-intercept';
                        const isDuet = gameMode === 'duet';
                        const isLanguageForbidden = mod.id === 'lost-in-translation' && language === 'all';
                        
                        const isDoodleForbidden = clueType === 'doodle' && ['vowel-void', 'five-letter-curse', 'boolean-search', 'oracle-riddle'].includes(mod.id);
                        const isEmojiForbidden = selectedPacks.includes('emojis') && ['lost-in-translation', 'censored-documents'].includes(mod.id);
                        const isCustomWordsForbidden = customWordsArray && customWordsArray.length > 0 && mod.id === 'lost-in-translation';

                        const isModDisabled = (isTimerRequired && isTimerOff) || 
                          (isDuetForbidden && isDuet) || 
                          isLanguageForbidden || 
                          isDoodleForbidden || 
                          isEmojiForbidden ||
                          isCustomWordsForbidden;
                        const isEnabled = enabledModifiers.includes(mod.id) && !isModDisabled;
                        const IconComponent = MODIFIER_ICONS[mod.icon] || HelpCircle;

                        const handleRowToggle = () => {
                          if (!isHost || !setEnabledModifiers || isModDisabled) return;
                          if (isEnabled) {
                            setEnabledModifiers(enabledModifiers.filter(id => id !== mod.id));
                          } else {
                            setEnabledModifiers([...enabledModifiers, mod.id]);
                          }
                        };

                        return (
                          <div 
                            key={mod.id}
                            onClick={handleRowToggle}
                            className={cn(
                              "flex items-start gap-3 p-3 rounded-2xl border-2 text-left select-none relative group transition-all duration-300",
                              isModDisabled ? "opacity-30 cursor-not-allowed grayscale" : (isHost ? "cursor-pointer" : "cursor-default opacity-85"),
                              isEnabled 
                                ? (category === 'spymaster' 
                                  ? "bg-[#16162d] border-indigo-600" 
                                  : category === 'board' 
                                    ? "bg-[#271b0c] border-amber-600" 
                                    : "bg-[#271015] border-rose-600")
                                : "bg-[#222222] border-[#333333] hover:border-slate-600"
                            )}
                          >
                            <div className="flex-1 min-w-0 pr-6">
                              <div className="flex items-center gap-2 mb-1 group-hover:text-red-400 transition-colors">
                                <IconComponent className="w-5 h-5 text-red-500" />
                                <span className="font-black text-sm tracking-widest">{uiLanguage === 'ar' ? mod.nameAr || mod.name : mod.name}</span>
                              </div>
                              <p className="text-slate-400 text-[10px] leading-relaxed pr-8">{uiLanguage === 'ar' ? mod.descriptionAr || mod.description : mod.description}</p>
                            </div>
                            
                            {/* Checkbox display */}
                            <div className="absolute right-3 top-3">
                              <div className={cn(
                                "w-4.5 h-4.5 rounded flex items-center justify-center border transition-colors",
                                isEnabled 
                                  ? (category === 'spymaster' 
                                    ? "bg-indigo-500 border-indigo-500 text-white" 
                                    : category === 'board' 
                                      ? "bg-amber-500 border-amber-500 text-white" 
                                      : "bg-rose-500 border-rose-500 text-white")
                                  : "border-slate-600 text-transparent"
                              )}>
                                {isEnabled && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <button 
              onClick={() => setShowChaosModal(false)}
              className="mt-6 w-full py-3 bg-red-500 hover:bg-red-400 rounded-xl font-black tracking-widest text-white shadow-lg shadow-red-950/50 transition-colors shrink-0"
            >
              DONE
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
