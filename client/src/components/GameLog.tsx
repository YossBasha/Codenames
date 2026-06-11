import { useEffect, useRef, useState } from "react";
import type { LogEntry } from "../../../shared/types";
import { cn } from "../utils";
import { useI18n } from "../context/I18nContext";

function LogAvatar({
  src,
  name,
  className,
  fallbackBgClass,
}: {
  src: string;
  name: string;
  className?: string;
  fallbackBgClass?: string;
}) {
  const [hasError, setHasError] = useState(!src);

  const initials = name
    ? name
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "?";

  if (hasError) {
    return (
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-black text-white shrink-0 shadow-inner select-none",
          className,
          fallbackBgClass || "bg-slate-700",
        )}
      >
        <span className="text-[35%] leading-none">{initials}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setHasError(true)}
      className={className}
    />
  );
}

interface GameLogProps {
  logs: LogEntry[];
  gameMode?: "classic" | "duet";
}

export default function GameLog({ logs, gameMode = "classic" }: GameLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex flex-col bg-black/40 border border-slate-700/50 rounded-2xl overflow-hidden h-[190px] lg:h-[420px] shrink-0 relative w-full">
      <div className="bg-black/40 p-2 lg:py-2.5 text-center text-xs lg:text-sm font-black tracking-widest text-slate-500 absolute top-0 left-0 right-0 z-10 shadow-md h-8 lg:h-10">
        {t("game_log")}
      </div>
      <div className="absolute top-8 lg:top-10 left-0 right-0 bottom-0 overflow-y-auto p-2.5 lg:p-3.5 flex flex-row flex-wrap content-start gap-1.5 lg:gap-2.5 scrollbar-thin scrollbar-thumb-slate-700">
        {logs.length === 0 ? (
          <div className="text-slate-500 text-sm text-center italic mt-auto mb-auto w-full">
            {t("no_moves_yet")}
          </div>
        ) : (
          logs.map((log) => {
            if (log.type === "cue") {
              const isRed = log.team === "red";
              const isDuet = gameMode === "duet";

              let bgClass = isRed
                ? "bg-red-500 border-red-400"
                : "bg-blue-500 border-blue-400";
              let nameBgClass = isRed ? "bg-red-600" : "bg-blue-600";

              if (isDuet) {
                bgClass = isRed
                  ? "bg-lime-500 border-lime-400"
                  : "bg-emerald-500 border-emerald-400";
                nameBgClass = isRed ? "bg-lime-600" : "bg-emerald-600";
              }

              return (
                <div
                  key={log.id}
                  className="flex items-center w-full shrink-0 animate-in fade-in slide-in-from-bottom-2 relative"
                >
                  <div className="flex flex-col items-center shrink-0 relative z-10">
                    <LogAvatar
                      src={log.player.avatarUrl}
                      name={log.player.name}
                      className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-black/20 shrink-0 border-2 border-white/90"
                      fallbackBgClass={nameBgClass}
                    />
                    <span
                      className={cn(
                        "px-1 py-0.5 rounded font-black text-[6px] lg:text-[8px] leading-none mt-0.5 truncate max-w-[28px] lg:max-w-[48px] text-center text-white shadow-sm",
                        nameBgClass,
                      )}
                    >
                      {log.player.name}
                    </span>
                  </div>

                  <div
                    className={cn(
                      "flex-1 flex items-center justify-between rounded-xl lg:rounded-2xl p-1 lg:p-1.5 shadow-md border gap-1.5 min-w-0 -ml-3 lg:-ml-4 pl-4 lg:pl-5",
                      bgClass,
                    )}
                  >
                    <div className="bg-white rounded-lg lg:rounded-xl px-1.5 py-0.5 lg:px-3 lg:py-1.5 flex-1 text-center shadow-inner min-w-0 flex items-center justify-center min-h-[24px] lg:min-h-[34px]">
                      {log.cueWord.startsWith("data:image") ? (
                        <img
                          src={log.cueWord}
                          alt="Clue"
                          className="h-5 lg:h-7 object-contain mx-auto"
                        />
                      ) : (
                        <span className="text-slate-950 font-black text-[9px] lg:text-xs tracking-normal uppercase whitespace-normal break-words leading-tight w-full">
                          {log.cueWord}
                        </span>
                      )}
                    </div>

                    <div className="w-5 h-5 lg:w-7 lg:h-7 rounded-full flex items-center justify-center font-black text-[9px] lg:text-xs shrink-0 bg-white text-slate-950 shadow-md">
                      {log.cueNumber === 99 ? "∞" : log.cueNumber}
                    </div>
                  </div>
                </div>
              );
            } else if (log.type === "guess") {
              const isGuessRed = log.guessingTeam === "red";
              const isDuet = gameMode === "duet";
              let nameBgClass = isGuessRed ? "bg-red-600" : "bg-blue-600";

              if (isDuet) {
                nameBgClass = isGuessRed ? "bg-lime-600" : "bg-emerald-600";
              }

              let bgColor = "bg-slate-700";
              let textColor = "text-white";

              if (log.revealedColor === "red") {
                bgColor = "bg-red-500";
                textColor = "text-black";
              } else if (log.revealedColor === "blue") {
                bgColor = "bg-blue-500";
                textColor = "text-black";
              } else if (log.revealedColor === "assassin") {
                bgColor = "bg-slate-900";
                textColor = "text-red-500";
              } else if (log.revealedColor === "green") {
                bgColor = "bg-green-500";
                textColor = "text-black";
              } else {
                bgColor = "bg-stone-400";
                textColor = "text-slate-950";
              }

              return (
                <div
                  key={log.id}
                  className="flex items-center gap-1 lg:gap-1.5 shrink-0 animate-in fade-in slide-in-from-left-2"
                >
                  <div className="flex flex-col items-center shrink-0">
                    <LogAvatar
                      src={log.player.avatarUrl}
                      name={log.player.name}
                      className="w-5 h-5 lg:w-7 lg:h-7 rounded-full bg-black/20 shadow-sm border-2 border-white/90"
                      fallbackBgClass={nameBgClass}
                    />
                    <span
                      className={cn(
                        "px-1 py-0.5 rounded font-black text-[6px] lg:text-[8px] leading-none mt-0.5 truncate max-w-[24px] lg:max-w-[42px] text-center text-white shadow-sm",
                        nameBgClass,
                      )}
                    >
                      {log.player.name}
                    </span>
                  </div>

                  <div
                    className={cn(
                      "px-1.5 py-0.5 lg:px-2.5 lg:py-1 rounded-lg lg:rounded-xl font-black text-[9px] lg:text-xs uppercase tracking-wide shadow-md border border-white/5 whitespace-normal break-words leading-tight text-center",
                      bgColor,
                      textColor,
                    )}
                  >
                    {log.cardWord}
                  </div>
                </div>
              );
            }
            return null;
          })
        )}
        <div ref={bottomRef} className="h-1 w-full" />
      </div>
    </div>
  );
}
