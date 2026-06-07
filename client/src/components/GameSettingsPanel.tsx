import { useState } from 'react';
import { BookOpen, Clock, X, Globe, Check, Keyboard, Upload, Volume2, VolumeX, PenTool } from 'lucide-react';
import { cn } from '../utils';
import type { Language, CustomWordWeight, TimerSettings, ClueType } from '../../../shared/types';
import { useGameContext } from '../context/GameContext';

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
  setClueType
}: GameSettingsPanelProps) {
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [showWordPacksModal, setShowWordPacksModal] = useState(false);
  const [showClueModal, setShowClueModal] = useState(false);
  const [customWordsTab, setCustomWordsTab] = useState<'type'|'upload'>('type');
  
  const { volume, setVolume } = useGameContext();

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
    } else if (preset === 'quick') {
      setTimerSettings({ preset, spymasterTime: 90, operativeTime: 60, extraFirstClueTime: 60 });
    } else if (preset === 'relaxed') {
      setTimerSettings({ preset, spymasterTime: 180, operativeTime: 120, extraFirstClueTime: 120 });
    } else {
      setTimerSettings(prev => ({ ...prev, preset }));
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 flex-1">
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => isHost && setGameMode('classic')}
            className={cn("flex items-center justify-center gap-2 rounded-2xl py-3 border-b-4 transition-all", 
              gameMode === 'classic' ? "bg-[#0ea5e9] border-blue-700 cursor-default" : "bg-[#333] border-[#222] opacity-50 hover:opacity-80"
            )}
          >
            <div className="text-center">
              <div className="font-black text-xl tracking-wider">CLASSIC</div>
              <div className="text-xs opacity-80">4+ PLAYERS</div>
            </div>
          </button>
          <button 
            onClick={() => isHost && setGameMode('duet')}
            className={cn("flex items-center justify-center gap-2 rounded-2xl py-3 border-b-4 transition-all", 
              gameMode === 'duet' ? "bg-green-600 border-green-800 cursor-default" : "bg-[#333] border-[#222] opacity-50 hover:opacity-80"
            )}
          >
            <div className="text-center">
              <div className="font-black text-xl tracking-wider">DUET</div>
              <div className="text-xs opacity-80">2+ PLAYERS</div>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
          <button 
            onClick={() => setShowWordPacksModal(true)}
            className={cn("flex flex-col items-center justify-center gap-2 rounded-2xl p-3 border transition-all h-full min-h-[90px]", 
              "bg-[#333] border-[#444] hover:border-indigo-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]"
            )}
          >
            <div className="p-2 rounded-full bg-indigo-500 text-white mb-1">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="font-black text-lg tracking-widest text-white mb-1">WORD PACKS</div>
              <div className="text-xs font-bold text-slate-400">
                {language.toUpperCase()} • {selectedPacks.length} packs
                {customWordsArray.length > 0 && ` • ${customWordWeight} custom`}
              </div>
            </div>
          </button>

          <button 
            onClick={() => setShowTimerModal(true)}
            className={cn("flex flex-col items-center justify-center gap-2 rounded-2xl p-3 border transition-all h-full min-h-[90px]", 
              timerSettings.preset !== 'off' ? "bg-[#333] border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]" : "bg-[#333] border-[#444] opacity-80 hover:opacity-100"
            )}
          >
            <div className={cn("p-2 rounded-full text-white mb-1", timerSettings.preset !== 'off' ? "bg-orange-500" : "bg-slate-600")}>
              <Clock className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="font-black text-lg tracking-widest text-white mb-1">TIMER</div>
              <div className="text-xs font-bold text-slate-400 tracking-wider">
                {timerSettings.preset === 'off' ? 'OFF' : timerSettings.preset.toUpperCase()}
              </div>
            </div>
          </button>



          <button 
            onClick={() => setShowClueModal(true)}
            className={cn("flex flex-col items-center justify-center gap-2 rounded-2xl p-3 border transition-all h-full min-h-[90px]", 
              clueType !== 'text' ? "bg-[#333] border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "bg-[#333] border-[#444] hover:border-emerald-500"
            )}
          >
            <div className={cn("p-2 rounded-full text-white mb-1", clueType !== 'text' ? "bg-emerald-500" : "bg-slate-600")}>
              <PenTool className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="font-black text-lg tracking-widest text-white mb-1">CLUES</div>
              <div className="text-xs font-bold text-slate-400 tracking-wider">
                {clueType === 'both' ? 'TEXT & DOODLES' : clueType === 'doodle' ? 'DOODLES ONLY' : 'TEXT ONLY'}
              </div>
            </div>
          </button>
        </div>
        <div className="bg-[#2a2a2a] rounded-2xl p-4 border border-[#444] shadow-inner mt-2 flex items-center gap-4">
          <div className="p-2 rounded-full bg-slate-700 text-white flex-shrink-0">
            {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-400 tracking-wider">SFX VOLUME</span>
              <span className="text-xs font-mono font-bold text-slate-300">{Math.round(volume * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 h-2 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {showWordPacksModal && (
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
                <h2 className="text-2xl font-black tracking-widest text-white">WORD SETTINGS</h2>
                <p className="text-sm font-bold text-slate-400">Configure language and vocabulary pools</p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="bg-[#2a2a2a] rounded-2xl p-4 border border-[#333] flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#444] p-2 rounded-lg text-white">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div className="font-black tracking-widest text-sm text-white">LANGUAGE</div>
                  </div>
                  
                  <div className="flex bg-[#222] p-1 rounded-lg border border-[#444]">
                    {(['all', 'en', 'de', 'ar'] as Language[]).map(lang => (
                      <button
                        key={lang}
                        onClick={() => isHost && setLanguage(lang)}
                        disabled={!isHost}
                        className={cn(
                          "px-4 py-1.5 rounded-md text-xs font-black tracking-wider transition-colors",
                          language === lang ? "bg-indigo-500 text-white shadow-md" : "text-slate-400 hover:text-white",
                          !isHost && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {lang === 'all' ? 'ALL' : lang.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className={cn("flex items-center gap-3 group bg-[#222] p-3 rounded-xl border border-[#444] transition-colors", isHost ? "cursor-pointer hover:border-indigo-500" : "opacity-70 cursor-not-allowed")}>
                    <div className={cn("w-5 h-5 rounded flex items-center justify-center border transition-colors", selectedPacks.includes('classic') ? "bg-indigo-500 border-indigo-500" : "border-slate-500")}>
                      {selectedPacks.includes('classic') && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={selectedPacks.includes('classic')} onChange={() => isHost && setSelectedPacks(prev => prev.includes('classic') ? prev.filter(p => p !== 'classic') : [...prev, 'classic'])} disabled={!isHost} />
                    <span className="text-sm font-bold text-slate-300">Base Pack</span>
                  </label>
                  <label className={cn("flex items-center gap-3 group bg-[#222] p-3 rounded-xl border border-[#444] transition-colors", isHost ? "cursor-pointer hover:border-indigo-500" : "opacity-70 cursor-not-allowed")}>
                    <div className={cn("w-5 h-5 rounded flex items-center justify-center border transition-colors", selectedPacks.includes('duet') ? "bg-indigo-500 border-indigo-500" : "border-slate-500")}>
                      {selectedPacks.includes('duet') && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={selectedPacks.includes('duet')} onChange={() => isHost && setSelectedPacks(prev => prev.includes('duet') ? prev.filter(p => p !== 'duet') : [...prev, 'duet'])} disabled={!isHost} />
                    <span className="text-sm font-bold text-slate-300">Duet Pack</span>
                  </label>
                  <label className={cn("flex items-center gap-3 group bg-[#222] p-3 rounded-xl border border-[#444] transition-colors", isHost ? "cursor-pointer hover:border-indigo-500" : "opacity-70 cursor-not-allowed")}>
                    <div className={cn("w-5 h-5 rounded flex items-center justify-center border transition-colors", selectedPacks.includes('emojis') ? "bg-indigo-500 border-indigo-500" : "border-slate-500")}>
                      {selectedPacks.includes('emojis') && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={selectedPacks.includes('emojis')} onChange={() => isHost && setSelectedPacks(prev => prev.includes('emojis') ? prev.filter(p => p !== 'emojis') : [...prev, 'emojis'])} disabled={!isHost} />
                    <span className="text-sm font-bold text-slate-300">Emojis 🎭</span>
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
                      <div className="font-black tracking-widest text-sm text-white">CUSTOM WORDS</div>
                      <div className="text-xs text-emerald-400 font-bold">Unique words: {customWordsArray.length}</div>
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
                      <Keyboard className="w-3.5 h-3.5" /> Type words
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
                      <Upload className="w-3.5 h-3.5" /> Upload file
                    </button>
                  </div>
                </div>

                {customWordsTab === 'type' ? (
                  <textarea
                    value={customWordsText}
                    onChange={(e) => setCustomWordsText(e.target.value)}
                    disabled={!isHost}
                    placeholder="Paste or type words here...&#10;One word per line."
                    className="w-full h-32 bg-[#222] border border-[#444] rounded-xl p-3 text-sm font-mono text-white focus:border-emerald-500 outline-none resize-none disabled:opacity-50"
                  />
                ) : (
                  <div className={cn("w-full h-32 bg-[#222] border-2 border-dashed border-[#444] rounded-xl flex flex-col items-center justify-center gap-2 relative transition-colors", isHost ? "hover:border-emerald-500" : "opacity-50")}>
                    <Upload className="w-8 h-8 text-slate-500" />
                    <div className="text-sm font-bold text-slate-400">Drag & Drop .txt or .csv</div>
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
                    <span>Custom Words Ratio</span>
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
              DONE
            </button>
          </div>
        </div>
      )}

      {showTimerModal && (
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
                <h2 className="text-2xl font-black tracking-widest text-white">TIMER SETTINGS</h2>
                <p className="text-sm font-bold text-slate-400">Configure turn limits</p>
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
                  {preset.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between bg-[#2a2a2a] p-4 rounded-2xl border border-[#333]">
                <div className="text-left">
                  <div className="font-bold text-white tracking-wider">Spymaster Turn</div>
                  <div className="text-xs text-slate-400">Base limit to give clue</div>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    value={timerSettings.spymasterTime}
                    disabled={!isHost || timerSettings.preset !== 'custom'}
                    onChange={e => setTimerSettings(p => ({ ...p, spymasterTime: Number(e.target.value) }))}
                    className="w-16 bg-[#111] border border-slate-700 rounded p-2 text-center font-mono font-bold text-white disabled:opacity-50"
                  />
                  <span className="text-slate-500 font-bold text-xs">SEC</span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#2a2a2a] p-4 rounded-2xl border border-[#333]">
                <div className="text-left">
                  <div className="font-bold text-white tracking-wider">Operative Turn</div>
                  <div className="text-xs text-slate-400">Time per guess cycle</div>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    value={timerSettings.operativeTime}
                    disabled={!isHost || timerSettings.preset !== 'custom'}
                    onChange={e => setTimerSettings(p => ({ ...p, operativeTime: Number(e.target.value) }))}
                    className="w-16 bg-[#111] border border-slate-700 rounded p-2 text-center font-mono font-bold text-white disabled:opacity-50"
                  />
                  <span className="text-slate-500 font-bold text-xs">SEC</span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#2a2a2a] p-4 rounded-2xl border border-[#333]">
                <div className="text-left">
                  <div className="font-bold text-white tracking-wider">+ First Clue Bonus</div>
                  <div className="text-xs text-slate-400">Added to round 1 only</div>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    value={timerSettings.extraFirstClueTime}
                    disabled={!isHost || timerSettings.preset !== 'custom'}
                    onChange={e => setTimerSettings(p => ({ ...p, extraFirstClueTime: Number(e.target.value) }))}
                    className="w-16 bg-[#111] border border-slate-700 rounded p-2 text-center font-mono font-bold text-white disabled:opacity-50"
                  />
                  <span className="text-slate-500 font-bold text-xs">SEC</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setShowTimerModal(false)}
              className="mt-8 w-full py-3 bg-orange-500 hover:bg-orange-400 rounded-xl font-black tracking-widest text-white shadow-lg transition-colors"
            >
              DONE
            </button>
          </div>
        </div>
      )}
    {showClueModal && (
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
                <h2 className="text-2xl font-black tracking-widest text-white">CLUE TYPE</h2>
                <p className="text-sm font-bold text-slate-400">How spymasters give clues</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {[
                { type: 'both', label: 'TEXT & DOODLES', desc: 'Spymasters can type words or draw pictures' },
                { type: 'text', label: 'TEXT ONLY', desc: 'Spymasters can only type words (Classic)' },
                { type: 'doodle', label: 'DOODLES ONLY', desc: 'Spymasters can only draw pictures' }
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
              DONE
            </button>
          </div>
        </div>
      )}
    </>
  );
}
