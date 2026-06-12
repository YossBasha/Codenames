import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useGameContext } from '../context/GameContext';
import { useI18n } from '../context/I18nContext';
import { playMenuHoverSfx, playMenuClickSfx } from '../utils/sfx';
import { Palette, X, Check, Globe } from 'lucide-react';
import { cn } from '../utils';
import type { ThemeType } from '../../../shared/types';
import { useState } from 'react';
import { getLocalServerPort } from '../utils/discovery';

export default function Home() {
  const navigate = useNavigate();
  const { socket, setSocket, theme, setTheme } = useGameContext();
  const { t, uiLanguage, setUiLanguage } = useI18n();
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showHostModal, setShowHostModal] = useState(false);
  const [isNgrokActive, setIsNgrokActive] = useState(false);

  useEffect(() => {
    let active = true;
    const checkNgrok = async () => {
      try {
        const port = await getLocalServerPort();
        const res = await fetch(`http://127.0.0.1:${port}/api/ngrok-status`);
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setIsNgrokActive(!!data.active);
          }
        }
      } catch (e) {
        if (active) setIsNgrokActive(false);
      }
    };

    checkNgrok();
    const interval = setInterval(checkNgrok, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  }, [socket, setSocket]);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-red-500/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]" />

      {/* Language Toggle Button */}
      <button
        onClick={() => setUiLanguage(uiLanguage === 'en' ? 'ar' : 'en')}
        className="absolute top-4 left-4 z-50 p-3 bg-slate-800/80 hover:bg-slate-700/80 rounded-full border border-slate-600 transition-colors shadow-lg backdrop-blur flex items-center gap-2"
        title="Toggle UI Language"
      >
        <Globe className="w-5 h-5 text-sky-400" />
        <span className="text-sky-400 font-bold text-sm leading-none pt-[2px]">
          {uiLanguage === 'en' ? 'AR' : 'EN'}
        </span>
      </button>

      {/* Theme Button */}
      <button
        onClick={() => setShowThemeModal(true)}
        className="absolute top-4 right-4 z-50 p-3 bg-slate-800/80 hover:bg-slate-700/80 rounded-full border border-slate-600 transition-colors shadow-lg backdrop-blur"
      >
        <Palette className="w-6 h-6 text-pink-500" />
      </button>

      <div className="z-10 flex flex-col items-center gap-8 w-full max-w-md glass p-8 rounded-3xl">
        <div className="text-center">
          <h1 className="text-5xl font-black mb-2 tracking-tight bg-gradient-to-r from-red-500 to-blue-500 bg-clip-text text-transparent">
            {t('title')}
          </h1>
          <p className="text-slate-400 font-medium">{t('subtitle')}</p>
        </div>

        <div className="flex flex-col w-full gap-4 mt-8">
          <button
            onMouseEnter={playMenuHoverSfx}
            onClick={() => { playMenuClickSfx(); navigate('/pass-and-play'); }}
            className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 rounded-xl font-bold text-lg shadow-lg shadow-purple-500/25 transition-all transform hover:-translate-y-1"
          >
            {t('pass_and_play')}
          </button>
          
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-700"></div>
            <span className="flex-shrink-0 mx-4 text-slate-500 text-sm font-bold">{t('multiplayer')}</span>
            <div className="flex-grow border-t border-slate-700"></div>
          </div>

          <div className="flex gap-4">
            <button
              onMouseEnter={playMenuHoverSfx}
              onClick={() => { playMenuClickSfx(); setShowHostModal(true); }}
              className="flex-1 py-4 px-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl font-bold text-lg transition-all transform hover:-translate-y-1"
            >
              {t('create_game')}
            </button>
            <button
              onMouseEnter={playMenuHoverSfx}
              onClick={() => { playMenuClickSfx(); navigate('/join-game'); }}
              className="flex-1 py-4 px-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl font-bold text-lg transition-all transform hover:-translate-y-1"
            >
              {t('join_game')}
            </button>
          </div>
        </div>
      </div>

      {/* Version badge */}
      <div className="z-10 mt-6 text-slate-600 text-xs font-mono tracking-widest select-none">
        v{__APP_VERSION__}
      </div>

      {showThemeModal && setTheme && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-md p-6 border-2 border-slate-700 shadow-2xl relative">
            <button 
              onClick={() => setShowThemeModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="flex items-center gap-4 mb-8">
              <div className="bg-pink-500 p-3 rounded-full text-white">
                <Palette className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-widest text-white">{t('theme_settings')}</h2>
                <p className="text-sm font-bold text-slate-400">{t('change_visual_style')}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {(['default', 'cyberpunk', 'noir'] as ThemeType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between",
                    theme === t 
                      ? "bg-slate-800 border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.2)]" 
                      : "bg-[#222] border-[#333] hover:border-slate-500"
                  )}
                >
                  <span className="font-black tracking-widest text-white uppercase">{t}</span>
                  {theme === t && <Check className="w-5 h-5 text-pink-500" />}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setShowThemeModal(false)}
              className="mt-8 w-full py-3 bg-pink-500 hover:bg-pink-400 rounded-xl font-black tracking-widest text-white shadow-lg transition-colors"
            >
              {t('done')}
            </button>
          </div>
        </div>
      )}

      {showHostModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-md p-6 border-2 border-slate-700 shadow-2xl relative">
            <button 
              onClick={() => setShowHostModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <h2 className="text-2xl font-black tracking-widest text-white mb-6">{t('host_game').toUpperCase()}</h2>

            <div className="flex flex-col gap-3">
              <button
                disabled={!isNgrokActive}
                onClick={() => { playMenuClickSfx(); navigate('/lan-lobby?host=true&wan=true'); }}
                className={cn(
                  "w-full text-left p-4 rounded-xl border-2 flex flex-col gap-1 transition-all",
                  isNgrokActive 
                    ? "bg-[#222] border-[#333] hover:border-slate-500 text-white cursor-pointer" 
                    : "bg-slate-800/50 border-slate-700 cursor-not-allowed opacity-60 text-slate-400"
                )}
              >
                <span className={cn("font-black tracking-widest uppercase", isNgrokActive ? "text-white" : "text-slate-400")}>
                  {t('online_public_room')}
                </span>
                <span className={cn("text-sm font-bold", isNgrokActive ? "text-slate-400" : "text-slate-500")}>
                  {isNgrokActive ? t('host_global_internet') : t('online_public_coming_soon')}
                </span>
              </button>
              
              <button
                onClick={() => { playMenuClickSfx(); navigate('/lan-lobby?host=true'); }}
                className="w-full text-left p-4 rounded-xl border-2 bg-[#222] border-[#333] hover:border-slate-500 transition-all flex flex-col gap-1"
              >
                <span className="font-black tracking-widest text-white uppercase">{t('local_network_lan')}</span>
                <span className="text-sm font-bold text-slate-400">{t('host_same_wifi')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
