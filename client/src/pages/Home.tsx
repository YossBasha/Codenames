import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useGameContext } from "../context/GameContext";
import { useI18n } from "../context/I18nContext";
import { playMenuHoverSfx, playMenuClickSfx } from "../utils/sfx";
import { Palette, X, Check, Globe, Sparkles } from "lucide-react";
import { cn } from "../utils";
import type { ThemeType } from "../../../shared/types";
import { useState } from "react";
import { getLocalServerPort } from "../utils/discovery";
import { SPECIAL_AVATAR } from "../assets/specialAvatar";
import packageJson from "../../package.json";

const AVATAR_TEMPLATES = [
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Jack",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Jasmine",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Milo",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Zoe",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Oliver",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Sophia",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Buster",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Cody",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Sparky",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Robo",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Gizmo",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Rusty",
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Avery",
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Taylor",
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Jordan",
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Alex",
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Morgan",
  "https://api.dicebear.com/7.x/pixel-art/svg?seed=Sam",
  "https://api.dicebear.com/7.x/lorelei/svg?seed=Sasha",
  "https://api.dicebear.com/7.x/lorelei/svg?seed=Leo",
  "https://api.dicebear.com/7.x/lorelei/svg?seed=Maya",
  "https://api.dicebear.com/7.x/lorelei/svg?seed=Kai",
  "https://api.dicebear.com/7.x/lorelei/svg?seed=Luna",
  "https://api.dicebear.com/7.x/lorelei/svg?seed=Mimi",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Max",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Amy",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Bella",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Leo",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='60' r='35' fill='%2322c55e'/><circle cx='35' cy='35' r='15' fill='%2322c55e'/><circle cx='65' cy='35' r='15' fill='%2322c55e'/><circle cx='35' cy='35' r='10' fill='white'/><circle cx='65' cy='35' r='10' fill='white'/><circle cx='35' cy='35' r='5' fill='black'/><circle cx='65' cy='35' r='5' fill='black'/><path d='M 35 65 Q 50 85 65 65' stroke='black' stroke-width='4' fill='none' stroke-linecap='round'/><circle cx='25' cy='65' r='6' fill='%23fca5a5' opacity='0.7'/><circle cx='75' cy='65' r='6' fill='%23fca5a5' opacity='0.7'/></svg>",
];

export default function Home() {
  const navigate = useNavigate();
  const { socket, setSocket, theme, setTheme, player, setPlayer } =
    useGameContext();
  const { t, uiLanguage, setUiLanguage } = useI18n();
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showHostModal, setShowHostModal] = useState(false);
  const [isNgrokActive, setIsNgrokActive] = useState(false);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [profileName, setProfileName] = useState(player?.name || "");
  const [profileAvatar, setProfileAvatar] = useState(
    player?.avatarBase64 || AVATAR_TEMPLATES[0],
  );
  const isFirstTime = !localStorage.getItem("codenames_nickname")?.trim();

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem("codenames_last_seen_version");
    const currentVersion = packageJson.version;
    if (lastSeenVersion && lastSeenVersion !== currentVersion) {
      setShowUpdateModal(true);
    } else if (!lastSeenVersion) {
      localStorage.setItem("codenames_last_seen_version", currentVersion);
    }
  }, []);

  useEffect(() => {
    const savedName = localStorage.getItem("codenames_nickname");
    if (!savedName || !savedName.trim()) {
      setShowProfileModal(true);
    }
  }, []);

  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [isUpdateDownloaded, setIsUpdateDownloaded] = useState(false);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    api.onUpdaterAvailable((version: string) => {
      setUpdateMessage(`Update ${version} available! Downloading...`);
      setIsCheckingUpdate(true);
    });

    api.onUpdaterNotAvailable(() => {
      setUpdateMessage(t("up_to_date"));
      setIsCheckingUpdate(false);
      setTimeout(() => setUpdateMessage(null), 3000);
    });

    api.onUpdaterProgress((progress: number) => {
      setUpdateMessage(`Downloading... ${Math.round(progress)}%`);
    });

    api.onUpdaterDownloaded(() => {
      setUpdateMessage("Update ready to install.");
      setIsUpdateDownloaded(true);
      setIsCheckingUpdate(false);
    });

    api.onUpdaterError((err: string) => {
      setUpdateMessage("Update failed.");
      setIsCheckingUpdate(false);
      setTimeout(() => setUpdateMessage(null), 3000);
    });

    return () => {
      api.removeAllUpdaterListeners?.();
    };
  }, [t]);

  const handleCheckUpdates = async () => {
    if (isCheckingUpdate) return;
    playMenuClickSfx();
    if (isUpdateDownloaded) {
      (window as any).electronAPI.installUpdate();
      return;
    }
    
    setIsCheckingUpdate(true);
    setUpdateMessage(t("checking"));
    try {
      const started = await (window as any).electronAPI.checkForUpdates();
      if (!started) {
        setUpdateMessage(t("update_check_failed"));
        setIsCheckingUpdate(false);
        setTimeout(() => setUpdateMessage(null), 3000);
      }
    } catch (e) {
      setUpdateMessage(t("update_check_failed"));
      setIsCheckingUpdate(false);
      setTimeout(() => setUpdateMessage(null), 3000);
    }
  };


  useEffect(() => {
    if (player) {
      if (player.name) setProfileName(player.name);
      if (player.avatarBase64) setProfileAvatar(player.avatarBase64);
    }
  }, [player]);

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
        onClick={() => setUiLanguage(uiLanguage === "en" ? "ar" : "en")}
        className="absolute top-4 left-4 z-50 p-3 bg-slate-800/80 hover:bg-slate-700/80 rounded-full border border-slate-600 transition-colors shadow-lg backdrop-blur flex items-center gap-2"
        title="Toggle UI Language"
      >
        <Globe className="w-5 h-5 text-sky-400" />
        <span className="text-sky-400 font-bold text-sm leading-none pt-[2px]">
          {uiLanguage === "en" ? "AR" : "EN"}
        </span>
      </button>

      {/* Theme Button */}
      <button
        onClick={() => setShowThemeModal(true)}
        className="absolute top-4 right-4 z-50 p-3 bg-slate-800/80 hover:bg-slate-700/80 rounded-full border border-slate-600 transition-colors shadow-lg backdrop-blur"
      >
        <Palette className="w-6 h-6 text-pink-500" />
      </button>

      <div className="z-10 flex flex-col items-center gap-6 w-full max-w-md glass p-8 rounded-3xl">
        <div className="text-center">
          <h1 className="text-5xl font-black mb-2 tracking-tight bg-gradient-to-r from-red-500 to-blue-500 bg-clip-text text-transparent">
            {t("title")}
          </h1>
          <p className="text-slate-400 font-medium">{t("subtitle")}</p>
        </div>

        {/* Profile Card */}
        <div
          onClick={() => {
            playMenuClickSfx();
            setShowProfileModal(true);
          }}
          className="w-full bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-800/60 hover:border-slate-600/80 transition-all shadow-lg group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <img
            src={
              player?.avatarBase64 ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player?.name || "Player")}`
            }
            alt="Avatar"
            className="w-12 h-12 rounded-full border-2 border-slate-600 bg-slate-900 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
              {t("your_profile")}
            </div>
            <div className="text-lg font-black text-white truncate">
              {player?.name || t("setup_profile")}
            </div>
          </div>
          <div className="text-slate-500 group-hover:text-white transition-colors text-xs font-bold uppercase tracking-widest px-3 py-1.5 bg-slate-900/60 border border-slate-700/40 rounded-xl select-none">
            {t("edit")}
          </div>
        </div>

        <div className="flex flex-col w-full gap-4 mt-2">
          <button
            onMouseEnter={playMenuHoverSfx}
            onClick={() => {
              playMenuClickSfx();
              navigate("/pass-and-play");
            }}
            className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 rounded-xl font-bold text-lg shadow-lg shadow-purple-500/25 transition-all transform hover:-translate-y-1"
          >
            {t("pass_and_play")}
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-700"></div>
            <span className="flex-shrink-0 mx-4 text-slate-500 text-sm font-bold">
              {t("multiplayer")}
            </span>
            <div className="flex-grow border-t border-slate-700"></div>
          </div>

          <div className="flex gap-4">
            <button
              onMouseEnter={playMenuHoverSfx}
              onClick={() => {
                playMenuClickSfx();
                setShowHostModal(true);
              }}
              className="flex-1 py-4 px-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl font-bold text-lg transition-all transform hover:-translate-y-1"
            >
              {t("create_game")}
            </button>
            <button
              onMouseEnter={playMenuHoverSfx}
              onClick={() => {
                playMenuClickSfx();
                navigate("/join-game");
              }}
              className="flex-1 py-4 px-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl font-bold text-lg transition-all transform hover:-translate-y-1"
            >
              {t("join_game")}
            </button>
          </div>
        </div>
      </div>

      {/* Version badge */}
      <div className="z-10 mt-6 flex flex-col items-center gap-2">
        <div
          onClick={() => {
            playMenuClickSfx();
            setShowUpdateModal(true);
          }}
          className="text-slate-600 hover:text-slate-400 text-xs font-mono tracking-widest cursor-pointer select-none transition-colors"
        >
          v{__APP_VERSION__}
        </div>

        {typeof window !== "undefined" && (window as any).electronAPI?.checkForUpdates && (
          <button
            disabled={isCheckingUpdate}
            onClick={handleCheckUpdates}
            className="px-3 py-1 bg-slate-800/80 hover:bg-slate-700/80 disabled:opacity-50 text-[10px] font-black text-slate-400 hover:text-white rounded-full border border-slate-700/60 shadow transition-all cursor-pointer uppercase tracking-wider"
          >
            {isUpdateDownloaded ? "Install & Relaunch" : (isCheckingUpdate ? t("checking") : t("check_for_updates"))}
          </button>
        )}

        {updateMessage && (
          <div className="text-[10px] font-black text-amber-500 animate-pulse transition-all">
            {updateMessage}
          </div>
        )}
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
                <h2 className="text-2xl font-black tracking-widest text-white">
                  {t("theme_settings")}
                </h2>
                <p className="text-sm font-bold text-slate-400">
                  {t("change_visual_style")}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {(["default", "cyberpunk", "noir"] as ThemeType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between",
                    theme === t
                      ? "bg-slate-800 border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.2)]"
                      : "bg-[#222] border-[#333] hover:border-slate-500",
                  )}
                >
                  <span className="font-black tracking-widest text-white uppercase">
                    {t}
                  </span>
                  {theme === t && <Check className="w-5 h-5 text-pink-500" />}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowThemeModal(false)}
              className="mt-8 w-full py-3 bg-pink-500 hover:bg-pink-400 rounded-xl font-black tracking-widest text-white shadow-lg transition-colors"
            >
              {t("done")}
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

            <h2 className="text-2xl font-black tracking-widest text-white mb-6">
              {t("host_game").toUpperCase()}
            </h2>

            <div className="flex flex-col gap-3">
              <button
                disabled={!isNgrokActive}
                onClick={() => {
                  playMenuClickSfx();
                  navigate("/lan-lobby?host=true&wan=true");
                }}
                className={cn(
                  "w-full text-left p-4 rounded-xl border-2 flex flex-col gap-1 transition-all",
                  isNgrokActive
                    ? "bg-[#222] border-[#333] hover:border-slate-500 text-white cursor-pointer"
                    : "bg-slate-800/50 border-slate-700 cursor-not-allowed opacity-60 text-slate-400",
                )}
              >
                <span
                  className={cn(
                    "font-black tracking-widest uppercase",
                    isNgrokActive ? "text-white" : "text-slate-400",
                  )}
                >
                  {t("online_public_room")}
                </span>
                <span
                  className={cn(
                    "text-sm font-bold",
                    isNgrokActive ? "text-slate-400" : "text-slate-500",
                  )}
                >
                  {isNgrokActive
                    ? t("host_global_internet")
                    : t("online_public_coming_soon")}
                </span>
              </button>

              <button
                onClick={() => {
                  playMenuClickSfx();
                  navigate("/lan-lobby?host=true");
                }}
                className="w-full text-left p-4 rounded-xl border-2 bg-[#222] border-[#333] hover:border-slate-500 transition-all flex flex-col gap-1"
              >
                <span className="font-black tracking-widest text-white uppercase">
                  {t("local_network_lan")}
                </span>
                <span className="text-sm font-bold text-slate-400">
                  {t("host_same_wifi")}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#1a1a1a] rounded-3xl w-full max-w-md p-6 border-2 border-slate-700 shadow-2xl relative flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            {!isFirstTime && (
              <button
                onClick={() => setShowProfileModal(false)}
                className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            )}

            <div className="text-center mt-2">
              <h2 className="text-2xl font-black tracking-widest text-white">
                {isFirstTime ? t("welcome_to_codenames") : t("your_profile")}
              </h2>
              <p className="text-sm font-bold text-slate-400 mt-1">
                {isFirstTime ? t("choose_nickname") : t("setup_profile")}
              </p>
            </div>

            {/* Avatar Preview & Name Input */}
            <div className="flex flex-col items-center gap-4 bg-slate-800/40 border border-slate-700/50 p-4 rounded-2xl">
              <img
                src={
                  profileAvatar ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profileName || "Player")}`
                }
                alt="Selected Avatar"
                className="w-20 h-20 rounded-full border-4 border-emerald-500 bg-slate-900 shadow-lg"
              />
              <input
                type="text"
                placeholder={t("nickname")}
                value={profileName}
                onChange={(e) =>
                  setProfileName(
                    e.target.value.replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, ""),
                  )
                }
                maxLength={16}
                className="w-full bg-[#111] text-white border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 font-black text-center text-lg placeholder:text-slate-600"
              />
            </div>

            {/* Avatar Selection Grid */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">
                {t("choose_avatar")}
              </label>
              <div className="grid grid-cols-4 gap-2 bg-[#111] p-3 rounded-2xl border border-slate-800 max-h-48 overflow-y-auto scrollbar-thin">
                {(() => {
                  const showSpecial =
                    profileName.includes("Yoss") && !profileName.includes(" ");
                  const list = showSpecial
                    ? [SPECIAL_AVATAR, ...AVATAR_TEMPLATES]
                    : AVATAR_TEMPLATES;
                  return list.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        playMenuClickSfx();
                        setProfileAvatar(url);
                      }}
                      className={cn(
                        "aspect-square rounded-xl border-2 overflow-hidden transition-all bg-slate-800 hover:scale-105 relative",
                        profileAvatar === url
                          ? "border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] bg-slate-700"
                          : "border-transparent",
                      )}
                    >
                      <img
                        src={url}
                        alt={`Avatar option ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ));
                })()}
              </div>
            </div>

            <button
              disabled={!profileName.trim()}
              onClick={() => {
                const trimmedName = profileName.trim();
                localStorage.setItem("codenames_nickname", trimmedName);

                const saveAvatar = (avatarUrl: string) => {
                  localStorage.setItem("codenames_avatar", avatarUrl);
                  if (setPlayer) {
                    setPlayer((prev: any) => ({
                      ...prev,
                      name: trimmedName,
                      avatarBase64: avatarUrl,
                    }));
                  }
                  playMenuClickSfx();
                  setShowProfileModal(false);
                };

                if (profileAvatar.startsWith("data:image")) {
                  // Compress base64 images (like the 1.17 MB special Yoss avatar) using a canvas to maximum 128x128 pixels
                  const img = new Image();
                  img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const maxDim = 128;
                    let width = img.width;
                    let height = img.height;

                    if (width > maxDim || height > maxDim) {
                      if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                      } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                      }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                      ctx.drawImage(img, 0, 0, width, height);
                      const compressedData = canvas.toDataURL("image/png");
                      saveAvatar(compressedData);
                    } else {
                      saveAvatar(profileAvatar);
                    }
                  };
                  img.onerror = () => {
                    saveAvatar(profileAvatar);
                  };
                  img.src = profileAvatar;
                } else {
                  // Direct URL templates
                  saveAvatar(profileAvatar);
                }
              }}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 uppercase tracking-widest text-sm"
            >
              {t("save_profile")}
            </button>
          </div>
        </div>
      )}

      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-gradient-to-b from-[#1a1a1a] to-[#121212] rounded-3xl w-full max-w-md p-6 border border-slate-700/60 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative flex flex-col gap-5 max-h-[90vh] overflow-y-auto animate-in scale-in duration-300">
            <button
              onClick={() => {
                playMenuClickSfx();
                localStorage.setItem(
                  "codenames_last_seen_version",
                  packageJson.version,
                );
                setShowUpdateModal(false);
              }}
              className="absolute top-4 right-4 p-2 bg-slate-800/80 rounded-full hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="text-center mt-2 flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 animate-pulse animate-duration-1000">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-black tracking-widest text-white mt-2">
                V{packageJson.version} IS LIVE!
              </h2>
              <p className="text-xs font-black tracking-widest text-amber-500 uppercase">
                {t("whats_new").toUpperCase()}
              </p>
            </div>

            <div className="flex flex-col gap-3.5 my-2">
              <div className="flex gap-3 bg-slate-800/30 border border-slate-800 p-3.5 rounded-2xl hover:bg-slate-800/50 transition-colors">
                <div className="text-2xl select-none">🍪</div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-black text-sm text-slate-100 tracking-wide">
                    NimNim's Bite (عضة نمنم)
                  </span>
                  <span className="text-xs font-semibold text-slate-400 leading-relaxed">
                    Three random cards disappear from the board for 2 turns in
                    Chaos mode!
                  </span>
                </div>
              </div>

              <div className="flex gap-3 bg-slate-800/30 border border-slate-800 p-3.5 rounded-2xl hover:bg-slate-800/50 transition-colors">
                <div className="text-2xl select-none">🌐</div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-black text-sm text-slate-100 tracking-wide">
                    Multi-Language Support
                  </span>
                  <span className="text-xs font-semibold text-slate-400 leading-relaxed">
                    Translate card grids into Dutch, German, French, and Spanish
                    mid-game!
                  </span>
                </div>
              </div>

              <div className="flex gap-3 bg-[#111] border border-slate-800/80 p-3.5 rounded-2xl">
                <div className="text-2xl select-none">👥</div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-black text-sm text-slate-100 tracking-wide">
                    LAN Lobby Enhancements
                  </span>
                  <span className="text-xs font-semibold text-slate-400 leading-relaxed">
                    Sleek scrollable players container and more profile avatars
                    to choose from.
                  </span>
                </div>
              </div>

              <div className="flex gap-3 bg-[#111] border border-slate-800/80 p-3.5 rounded-2xl">
                <div className="text-2xl select-none">📝</div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-black text-sm text-slate-100 tracking-wide">
                    Change log
                  </span>
                  <span className="text-xs font-semibold text-slate-400 leading-relaxed">
                    Added this very window! Literally.
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                playMenuClickSfx();
                localStorage.setItem(
                  "codenames_last_seen_version",
                  packageJson.version,
                );
                setShowUpdateModal(false);
              }}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-95 uppercase tracking-widest text-sm"
            >
              {t("awesome")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
