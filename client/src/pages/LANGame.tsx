import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { useGameContext } from "../context/GameContext";
import { useI18n } from "../context/I18nContext";
import type { GameState } from "../../../shared/types";
import Grid from "../components/Grid";
import TopBar from "../components/TopBar";
import TeamColumn from "../components/TeamColumn";
import GameLog from "../components/GameLog";
import ActiveClueBar from "../components/ActiveClueBar";
import PostGameDebrief from "../components/PostGameDebrief";
import CheatVoteModal from "../components/CheatVoteModal";
import BestClueShowcase from "../components/BestClueShowcase";
import GiveClueBar from "../components/GiveClueBar";
import { cn } from "../utils";
import { MODIFIER_ICONS } from "../components/GameSettingsPanel";
import type { Player } from "../../../shared/types";
import {
  playCardRevealSfx,
  playCardHoverSfx,
  playCardSelectSfx,
} from "../utils/sfx";
import { MODIFIERS } from "../../../shared/modifiers";

export default function LANGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isWan = searchParams.get("wan") === "true";
  const { player, roomId, socket } = useGameContext();
  const { t, uiLanguage } = useI18n();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<Player[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const roomPlayersRef = useRef<Player[]>([]);
  const [showDebrief, setShowDebrief] = useState(false);
  const [showBestClue, setShowBestClue] = useState(false);
  const [clueTargets, setClueTargets] = useState<number[]>([]);
  const [hostDisconnected, setHostDisconnected] = useState(false);
  const [showPrankMenu, setShowPrankMenu] = useState(false);

  // Custom Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const handleLeaveGame = () => {
    setConfirmModal({
      isOpen: true,
      title: t("confirm_leave_game"),
      description: t("confirm_leave_game"),
      onConfirm: () => {
        setConfirmModal(null);
        navigate("/");
      },
    });
  };

  // Turn Announcer
  const [showTurnAnnouncer, setShowTurnAnnouncer] = useState(false);
  const [queuedModifierBanner, setQueuedModifierBanner] = useState<
    string | null
  >(null);
  const prevPhaseForTurnRef = useRef<string | null>(null);
  const prevTurnTeamForTurnRef = useRef<string | null>(null);
  const modifierBannerTimerRef = useRef<any>(null);

  // Chaos Modifiers Local States
  const [showModifierBanner, setShowModifierBanner] = useState<string | null>(
    null,
  );
  const [sensoryTimeLeft, setSensoryTimeLeft] = useState<number | null>(null);
  const [lagSpikeSecondsLeft, setLagSpikeSecondsLeft] = useState<number | null>(
    null,
  );
  const [isLockToggleActive, setIsLockToggleActive] = useState(false);
  const [isBloodPactToggleActive, setIsBloodPactToggleActive] = useState(false);
  const [scrambleActive, setScrambleActive] = useState(false);
  const [gachaHighlightCardId, setGachaHighlightCardId] = useState<
    number | null
  >(null);
  const gachaAnimationTimersRef = useRef<number[]>([]);

  // Trigger announcement banner on turn / modifier change
  const triggerModifierBanner = (mod: string) => {
    if (modifierBannerTimerRef.current)
      clearTimeout(modifierBannerTimerRef.current);

    setShowModifierBanner(mod);
    setScrambleActive(false);

    modifierBannerTimerRef.current = setTimeout(() => {
      setShowModifierBanner(null);
      if (mod === "dimensional-scramble" || mod === "earthquake") {
        setScrambleActive(true);
        setTimeout(() => setScrambleActive(false), 2000);
      }
    }, 3500);

    setIsLockToggleActive(false);
    setIsBloodPactToggleActive(false);
    setSensoryTimeLeft(null);
    setLagSpikeSecondsLeft(null);
  };

  const handleReportClue = (clueId: string) => {
    socket?.emit("report_cheat", { roomId, clueId });
  };

  const handleReportActiveClue = () => {
    const lastCue = [...(gameState?.gameLog || [])].reverse().find(l => l.type === 'cue');
    if (lastCue) {
      setConfirmModal({
        isOpen: true,
        title: "Report Cheat",
        description: "You are about to report a clue. Do you really think it's a cheat?",
        onConfirm: () => {
          handleReportClue(lastCue.id);
          setConfirmModal(null);
        }
      });
    }
  };

  const handleVoteCheat = (vote: 'yes' | 'no') => {
    socket?.emit("vote_cheat", { roomId, vote });
  };

  const handleResolveCheat = (isCheat: boolean) => {
    socket?.emit("resolve_cheat", { roomId, isCheat });
  };

  useEffect(() => {
    return () => {
      if (modifierBannerTimerRef.current)
        clearTimeout(modifierBannerTimerRef.current);
    };
  }, []);

  // Sensory Deprivation color fade timer
  const isSpymasterTurn = gameState?.currentPhase === "spymaster";
  const isSensoryDep = gameState?.activeModifier === "sensory-deprivation";
  useEffect(() => {
    if (isSpymasterTurn && isSensoryDep) {
      if (showModifierBanner) {
        return;
      }
      if (sensoryTimeLeft === null) {
        setSensoryTimeLeft(5);
      } else if (sensoryTimeLeft > 0) {
        const timer = setTimeout(
          () => setSensoryTimeLeft(sensoryTimeLeft - 1),
          1000,
        );
        return () => clearTimeout(timer);
      }
    } else {
      setSensoryTimeLeft(null);
    }
  }, [isSpymasterTurn, isSensoryDep, sensoryTimeLeft, showModifierBanner]);

  // Lag Spike delay countdown timer
  const isOperativeGuessing = gameState?.currentPhase === "operative";
  const isLagSpike = gameState?.activeModifier === "lag-spike";
  const expectedGuessTeam =
    gameState?.gameMode === "duet"
      ? gameState.currentTurn === "red"
        ? "blue"
        : "red"
      : gameState?.currentTurn;

  const myPlayer = player
    ? roomPlayers.find((p) => p.id === player.id) || player
    : null;

  const isMyTurnToGuess = !!(
    gameState &&
    myPlayer &&
    myPlayer.team === expectedGuessTeam &&
    (gameState.gameMode === "duet" || myPlayer.role === "operative")
  );

  const isMyTurnToGiveClue = !!(
    gameState &&
    myPlayer &&
    myPlayer.team === gameState.currentTurn &&
    (gameState.gameMode === "duet" || myPlayer.role === "spymaster")
  );

  const isMyTurn =
    gameState?.currentPhase === "spymaster"
      ? isMyTurnToGiveClue
      : isMyTurnToGuess;

  const prevModifierRef = useRef<string | null>(null);
  const prevTurnRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.setDiscordActivity && gameState) {
      const mode = gameState.gameMode === "duet" ? "Duet" : "Classic";
      const phaseStr = gameState.currentPhase === "spymaster" ? "Spymaster's Turn" : "Operatives' Turn";
      const turnStr = gameState.currentTurn === "red" ? "Red Team" : "Blue Team";
      
      let scoreStr = "";
      if (gameState.gameMode === "classic") {
        scoreStr = ` | Score: ${gameState.redScore} - ${gameState.blueScore}`;
      } else {
        scoreStr = ` | Mistakes: ${gameState.timerTokens}/9`;
      }

      (window as any).electronAPI.setDiscordActivity({
        details: `Playing Multiplayer (${mode})`,
        state: `${turnStr} - ${phaseStr}${scoreStr}`,
        startTimestamp: Date.now()
      });
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState?.activeModifier) {
      // Modifiers only change when the turn changes (or when a new modifier is explicitly applied)
      const isNewModifier =
        gameState.activeModifier !== prevModifierRef.current;

      if (isNewModifier) {
        // If turn announcer is about to show or is currently showing, queue the modifier banner
        const willShowTurnAnnouncer =
          isMyTurn &&
          !gameState.winner &&
          (gameState.currentPhase !== prevPhaseForTurnRef.current ||
            gameState.currentTurn !== prevTurnTeamForTurnRef.current);

        if (showTurnAnnouncer || willShowTurnAnnouncer) {
          setQueuedModifierBanner(gameState.activeModifier);
        } else {
          triggerModifierBanner(gameState.activeModifier);
        }
      }
    } else {
      setShowModifierBanner(null);
      setScrambleActive(false);
      setQueuedModifierBanner(null);
    }

    if (gameState) {
      prevModifierRef.current = gameState.activeModifier || null;
      prevTurnRef.current = gameState.currentTurn;
    }
  }, [
    gameState?.activeModifier,
    gameState?.currentTurn,
    gameState?.currentPhase,
    gameState?.winner,
    isMyTurn,
    showTurnAnnouncer,
  ]);

  useEffect(() => {
    if (gameState && !gameState.winner) {
      if (isMyTurn) {
        if (
          gameState.currentPhase !== prevPhaseForTurnRef.current ||
          gameState.currentTurn !== prevTurnTeamForTurnRef.current
        ) {
          setShowTurnAnnouncer(true);
        }
      }
      prevPhaseForTurnRef.current = gameState.currentPhase;
      prevTurnTeamForTurnRef.current = gameState.currentTurn;
    }
  }, [
    isMyTurn,
    gameState?.currentPhase,
    gameState?.currentTurn,
    gameState?.winner,
  ]);

  const dismissTurnAnnouncer = () => {
    setShowTurnAnnouncer(false);
    if (queuedModifierBanner) {
      triggerModifierBanner(queuedModifierBanner);
      setQueuedModifierBanner(null);
    }
  };
  useEffect(() => {
    if (isOperativeGuessing && isLagSpike && isMyTurnToGuess) {
      if (lagSpikeSecondsLeft === null) {
        setLagSpikeSecondsLeft(15);
      } else if (lagSpikeSecondsLeft > 0) {
        const timer = setTimeout(
          () => setLagSpikeSecondsLeft(lagSpikeSecondsLeft - 1),
          1000,
        );
        return () => clearTimeout(timer);
      }
    } else {
      setLagSpikeSecondsLeft(null);
    }
  }, [isOperativeGuessing, isLagSpike, isMyTurnToGuess, lagSpikeSecondsLeft]);

  useEffect(() => {
    if (!socket || !roomId || !player) {
      navigate("/lan-lobby");
      return;
    }

    const handleGameUpdate = (newState: GameState) => {
      setGameState(newState);
    };

    const handleRoomUpdate = (room: any) => {
      if (room.gameState) {
        setGameState(room.gameState);
      }
      if (room.players) {
        setRoomPlayers(room.players);
        roomPlayersRef.current = room.players;
      }
      if (room.isPublic !== undefined) {
        setIsPublic(room.isPublic);
      }
    };

    const handleGachaStartAnimation = ({
      highlightSequence,
      targetCardId,
    }: {
      highlightSequence: number[];
      targetCardId: number;
    }) => {
      if (!highlightSequence || highlightSequence.length === 0) return;

      gachaAnimationTimersRef.current.forEach((timer) =>
        window.clearTimeout(timer),
      );
      gachaAnimationTimersRef.current = [];
      setGachaHighlightCardId(null);

      let currentDelay = 50;
      let step = 0;
      const maxSteps = highlightSequence.length;

      const tick = () => {
        if (step >= maxSteps) {
          setGachaHighlightCardId(targetCardId);
          playCardSelectSfx();
          const timer = window.setTimeout(() => {
            setGachaHighlightCardId(null);
          }, 1200);
          gachaAnimationTimersRef.current.push(timer);
          return;
        }

        setGachaHighlightCardId(highlightSequence[step]);
        playCardHoverSfx();

        step++;
        currentDelay = 50 + (step / maxSteps) * (step / maxSteps) * 200;
        const timer = window.setTimeout(tick, currentDelay);
        gachaAnimationTimersRef.current.push(timer);
      };

      tick();
    };

    // Pre-clear any old duplicate event listeners to prevent leaks on component re-mount/Vite hot-reloading
    socket.off("game_update");
    socket.off("room_update");
    socket.off("gacha_start_animation");
    socket.off("timer_tick");
    socket.off("trigger_prank");
    socket.off("return_to_lobby");
    socket.off("host_disconnected");
    socket.off("disconnect");

    socket.on("game_update", handleGameUpdate);
    socket.on("room_update", handleRoomUpdate);
    socket.on("gacha_start_animation", handleGachaStartAnimation);
    socket.on("timer_tick", async (timeRemaining: number) => {
      if (timeRemaining <= 10 && timeRemaining > 0) {
        const { triggerHeartbeatVibration } = await import("../utils/haptics");
        triggerHeartbeatVibration(timeRemaining);
      }
      setGameState((prev) => (prev ? { ...prev, timeRemaining } : null));
    });

    socket.on(
      "trigger_prank",
      async ({ targetPlayerId }: { targetPlayerId: string }) => {
        if (player?.id === targetPlayerId) {
          const { triggerPrankVibration } = await import("../utils/haptics");
          triggerPrankVibration();
        }
      },
    );

    socket.on("return_to_lobby", () => {
      // Reconstruct lobby URL from the socket connection info.
      // LANGame has no URL params, so we derive them from the live socket.
      const lobbyParams = new URLSearchParams();

      // Check if we're the host (first player in the room)
      const latestPlayers = roomPlayersRef.current;
      const amHostCheck =
        latestPlayers.length > 0 &&
        ((player?.sessionId &&
          latestPlayers[0].sessionId === player?.sessionId) ||
          latestPlayers[0].id === player?.id);

      // Always extract port from the live socket connection
      try {
        const socketUrl = new URL((socket.io as any).uri);
        if (isWan || isPublic) {
          lobbyParams.set("serverUrl", socketUrl.origin);
        } else {
          lobbyParams.set("port", socketUrl.port);
          if (!amHostCheck) {
            const connectedIp = socketUrl.hostname;
            if (connectedIp && connectedIp !== "127.0.0.1") {
              lobbyParams.set("ip", connectedIp);
            }
          }
        }
      } catch (_) {}

      if (amHostCheck) lobbyParams.set("host", "true");
      if (isWan || isPublic) lobbyParams.set("wan", "true");
      if (roomId) lobbyParams.set("room", roomId);

      navigate(`/lan-lobby?${lobbyParams.toString()}`);
    });

    let disconnectTimeout: any = null;
    const handleDisconnect = () => {
      console.log("Socket disconnected, starting redirect timeout...");
      if (!disconnectTimeout) {
        disconnectTimeout = setTimeout(() => {
          console.log("Connection lost for >5s, redirecting to home...");
          navigate("/");
        }, 5000);
      }
    };

    const handleConnect = () => {
      console.log("Socket reconnected, re-joining room:", roomId);
      if (disconnectTimeout) {
        clearTimeout(disconnectTimeout);
        disconnectTimeout = null;
      }
      socket.emit("join_room", { roomId, player, isPublic: isWan || isPublic });
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleDisconnect);

    socket.on("host_disconnected", () => {
      setHostDisconnected(true);
      setTimeout(() => navigate("/"), 4000);
    });

    // Request fresh room state immediately upon mounting
    socket.emit("join_room", { roomId, player, isPublic: isWan || isPublic });

    return () => {
      if (disconnectTimeout) {
        clearTimeout(disconnectTimeout);
      }
      gachaAnimationTimersRef.current.forEach((timer) =>
        window.clearTimeout(timer),
      );
      gachaAnimationTimersRef.current = [];
      socket.off("game_update", handleGameUpdate);
      socket.off("room_update", handleRoomUpdate);
      socket.off("gacha_start_animation", handleGachaStartAnimation);
      socket.off("timer_tick");
      socket.off("trigger_prank");
      socket.off("return_to_lobby");
      socket.off("host_disconnected");
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleDisconnect);
    };
  }, [socket, roomId, player, navigate]);

  // Ensure we use the freshest player state synced from the server (e.g. after randomize teams)
  const currentPlayer = roomPlayers.find((p) => p.id === player?.id) || player;

  const lastLogLength = useRef(0);
  useEffect(() => {
    if (gameState?.gameLog) {
      const currentLength = gameState.gameLog.length;
      if (
        currentLength > lastLogLength.current &&
        lastLogLength.current !== 0
      ) {
        const newLog = gameState.gameLog[currentLength - 1];
        if (newLog.type === "guess") {
          playCardRevealSfx(newLog.revealedColor as any);
        }
      }
      lastLogLength.current = currentLength;
    }
  }, [gameState?.gameLog]);

  const isHost = roomPlayers.length > 0 && roomPlayers[0].id === player?.id;

  const previousWinner = useRef<string | null>(null);
  useEffect(() => {
    if (gameState?.winner && gameState.winner !== previousWinner.current) {
      import("../utils/haptics").then(({ triggerPrankVibration }) => {
        triggerPrankVibration(); // Heavy impact for game over
      });
      // Delay showcase slightly so win banner renders first
      setTimeout(() => setShowBestClue(true), 600);
    }
    previousWinner.current = gameState?.winner || null;
  }, [gameState?.winner]);

  const prevTimerFrozenRef = useRef<boolean>(false);
  useEffect(() => {
    const isFrozen = !!gameState?.modifierState?.timerFrozen;
    if (isFrozen && !prevTimerFrozenRef.current) {
      import("../utils/sfx").then(({ playTimerFreezeSfx }) => {
        playTimerFreezeSfx();
      });
    }
    prevTimerFrozenRef.current = isFrozen;
  }, [gameState?.modifierState?.timerFrozen]);

  const handlePrank = (targetPlayerId: string) => {
    if (!socket || !roomId) return;
    socket.emit("prank_vibrate", { roomId, targetPlayerId });
    setShowPrankMenu(false);
  };

  useEffect(() => {
    if (gameState?.currentPhase === "operative") {
      setClueTargets([]);
    }
  }, [gameState?.currentPhase]);

  const isGivingClue =
    gameState &&
    !gameState.winner &&
    gameState.currentPhase === "spymaster" &&
    !(
      gameState.activeModifier === "d20-roll" &&
      gameState.modifierState?.canRevealForFree
    ) &&
    ((gameState.gameMode === "classic" &&
      currentPlayer?.team === gameState.currentTurn &&
      currentPlayer?.role === "spymaster") ||
      (gameState.gameMode === "duet" &&
        currentPlayer?.team === gameState.currentTurn));

  const handleCardClick = (id: number) => {
    if (!gameState || gameState.winner || !socket || !roomId) return;

    if (
      gameState.currentPhase === "spymaster" &&
      currentPlayer?.role === "spymaster" &&
      gameState.activeModifier === "d20-roll" &&
      gameState.modifierState?.canRevealForFree
    ) {
      setConfirmModal({
        isOpen: true,
        title: t("confirm_free_reveal"),
        description: t("confirm_free_reveal"),
        onConfirm: () => {
          socket.emit("d20_free_reveal", { roomId, cardId: id });
          setConfirmModal(null);
        },
      });
      return;
    }

    if (isLockToggleActive) {
      socket.emit("lock_card", { roomId, cardId: id });
      setIsLockToggleActive(false);
      return;
    }

    if (isBloodPactToggleActive) {
      socket.emit("use_blood_pact", { roomId, cardId: id });
      setIsBloodPactToggleActive(false);
      return;
    }

    if (isGivingClue) {
      const card = gameState.cards.find((c) => c.id === id);
      if (!card) return;

      let isValidClueTarget = false;
      const isSensoryFaded =
        gameState.activeModifier === "sensory-deprivation" && !shouldShowColors;
      if (isSensoryFaded) {
        if (gameState.gameMode === "classic") {
          isValidClueTarget = !card.revealed;
        } else {
          if (currentPlayer?.team === "red") {
            isValidClueTarget = !card.revealedByB;
          } else if (currentPlayer?.team === "blue") {
            isValidClueTarget = !card.revealedByA;
          }
        }
      } else {
        if (gameState.gameMode === "classic") {
          isValidClueTarget =
            card.type === currentPlayer?.team && !card.revealed;
        } else {
          if (currentPlayer?.team === "red") {
            isValidClueTarget = card.duetTypeA === "green" && !card.revealedByB;
          } else if (currentPlayer?.team === "blue") {
            isValidClueTarget = card.duetTypeB === "green" && !card.revealedByA;
          }
        }
      }

      if (!isValidClueTarget) return;

      setClueTargets((prev) =>
        prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
      );
      return;
    }

    if (gameState.gameMode !== "duet" && currentPlayer?.role === "spymaster")
      return; // Spymasters can't guess in classic
    if (gameState.currentPhase === "spymaster") return; // Nobody can guess in spymaster phase

    socket.emit("highlight_card", { roomId, cardId: id });
  };

  const handleGuessCard = (id: number) => {
    if (!gameState || gameState.winner || !socket || !roomId) return;
    if (
      gameState.activeModifier === "the-intercept" &&
      gameState.modifierState?.interceptPhase
    ) {
      socket.emit("intercept_guess", { roomId, cardId: id });
    } else {
      socket.emit("guess_card", { roomId, cardId: id });
    }
  };

  const handleCardContextMenu = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    if (!gameState || gameState.winner || !socket || !roomId) return;
    if (gameState.currentPhase !== "operative") return;
    socket.emit("highlight_card", { roomId, cardId: id });
  };

  const handleSubmitCue = (cue: string, number: number) => {
    if (!socket || !roomId) return;
    socket.emit("submit_cue", { roomId, cue, number, targets: clueTargets });
    setClueTargets([]);
  };

  const handleEndTurn = () => {
    if (!gameState || gameState.winner || !socket || !roomId) return;
    socket.emit("end_turn", { roomId });
  };

  const handleRestart = () => {
    if (socket && roomId) {
      socket.emit("play_again", { roomId });
    }
  };

  if (!gameState || !player)
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white flex flex-col font-sans relative overflow-x-hidden">
        {t("loading_game")}
      </div>
    );

  const isSpymaster =
    player.role === "spymaster" || gameState?.gameMode === "duet";

  const showCriticalHitTimer = !!(
    gameState &&
    gameState.activeModifier === "critical-hit" &&
    gameState.currentPhase === "operative" &&
    gameState.successfulGuessesThisTurn === 0 &&
    gameState.timerSettings &&
    gameState.timerSettings.preset !== "off"
  );

  const criticalHitTimeLeft = showCriticalHitTimer
    ? gameState.timeRemaining - (gameState.timerSettings.operativeTime - 5)
    : 0;

  const isCriticalHitTimerActive =
    showCriticalHitTimer && criticalHitTimeLeft > 0 && criticalHitTimeLeft <= 5;
  const isSensoryDepActive =
    gameState?.activeModifier === "sensory-deprivation" &&
    gameState?.currentPhase === "spymaster";
  const shouldShowColors =
    !isSensoryDepActive || sensoryTimeLeft === null || sensoryTimeLeft > 0;

  const bgClass = !gameState
    ? "bg-slate-900"
    : gameState.winner === "red"
      ? gameState.gameMode === "duet"
        ? "bg-lime-950"
        : "bg-red-950"
      : gameState.winner === "blue"
        ? "bg-blue-950"
        : gameState.winner === "spectator" // Duet loss
          ? "bg-slate-950"
          : gameState.currentTurn === "red"
            ? gameState.gameMode === "duet"
              ? "bg-lime-950"
              : "bg-[#2a1215]"
            : gameState.gameMode === "duet"
              ? "bg-green-950"
              : "bg-[#0e1a30]";

  const redOperatives = roomPlayers.filter(
    (p) => p.team === "red" && p.role === "operative",
  );
  const redSpymasters = roomPlayers.filter(
    (p) => p.team === "red" && p.role === "spymaster",
  );
  const blueOperatives = roomPlayers.filter(
    (p) => p.team === "blue" && p.role === "operative",
  );
  const blueSpymasters = roomPlayers.filter(
    (p) => p.team === "blue" && p.role === "spymaster",
  );

  let remainingGreens: number | undefined = undefined;
  if (gameState.gameMode === "duet") {
    let distinctGreensFound = 0;
    gameState.cards.forEach((c) => {
      const correctForB = c.duetTypeA === "green" && c.revealedByB;
      const correctForA = c.duetTypeB === "green" && c.revealedByA;
      if (correctForA || correctForB) distinctGreensFound++;
    });
    remainingGreens = Math.max(0, 15 - distinctGreensFound);
  }

  const amHost =
    roomPlayers.length > 0 &&
    ((player?.sessionId && roomPlayers[0].sessionId === player?.sessionId) ||
      roomPlayers[0].id === player?.id);

  const handleRestartGame = () => {
    setConfirmModal({
      isOpen: true,
      title: t("confirm_end_game"),
      description: t("confirm_end_game"),
      onConfirm: () => {
        socket?.emit("play_again", { roomId });
        setConfirmModal(null);
      },
    });
  };

  return (
    <div
      className={cn(
        `min-h-[100dvh] lg:min-h-0 lg:h-screen lg:max-h-screen lg:overflow-hidden flex flex-col relative overflow-y-auto transition-colors duration-1000`,
        bgClass,
      )}
    >


      {/* Host Disconnected Overlay */}
      {hostDisconnected && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1e1e1e] border-2 border-red-500/40 rounded-3xl p-8 max-w-md w-full shadow-[0_0_60px_rgba(239,68,68,0.2)] text-center flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-10 h-10 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v4m0 4h.01"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-white tracking-wide">
              {t("host_disconnected")}
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              {t("host_left_game")}
            </p>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-red-500 rounded-full animate-shrink-bar" />
            </div>
            <button
              onClick={() => navigate("/")}
              className="mt-1 px-8 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-2xl font-bold text-white transition-colors text-sm tracking-widest"
            >
              {t("return_now")}
            </button>
          </div>
        </div>
      )}

      {/* D20 Roll Animation Overlay */}
      {gameState.activeModifier === "d20-roll" &&
        gameState.modifierState?.rolled &&
        !gameState.modifierState?.rollCompleted && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[150] flex flex-col items-center justify-center p-4 animate-fade-in pointer-events-none">
            <div className="text-6xl sm:text-8xl md:text-9xl font-black text-indigo-400 animate-bounce drop-shadow-[0_0_30px_rgba(99,102,241,0.8)]">
              {gameState.modifierState.result}
            </div>
            <div className="mt-8 text-2xl sm:text-4xl font-black tracking-widest text-white uppercase text-center animate-pulse">
              {gameState.modifierState.result === 1 ? (
                <span className="text-red-500">{t("critical_failure")}</span>
              ) : gameState.modifierState.result === 20 ? (
                <span className="text-emerald-500">
                  {t("critical_success")}
                </span>
              ) : (
                <span className="text-indigo-300">{t("die_is_cast")}</span>
              )}
            </div>
          </div>
        )}

      {showTurnAnnouncer && !gameState.winner && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col items-center max-w-sm w-full animate-scale-up relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <Check className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white text-center mb-2 tracking-wide uppercase">
              {t("your_turn")}
            </h2>
            <p className="text-slate-400 text-center text-sm sm:text-base font-medium mb-8">
              {gameState.currentPhase === "spymaster"
                ? gameState.gameMode === "duet"
                  ? t("duet_announcer_desc").replace(
                      "{team}",
                      myPlayer?.team === "red" ? t("side_b") : t("side_a"),
                    )
                  : t("spymaster_announcer_desc")
                : t("operative_announcer_desc")}
            </p>
            <button
              onClick={dismissTurnAnnouncer}
              className="w-full h-14 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-500/25 active:scale-[0.98] uppercase tracking-widest text-sm sm:text-base"
            >
              {t("dismiss")}
            </button>
          </div>
        </div>
      )}

      <TopBar
        redScore={gameState.redScore}
        blueScore={gameState.blueScore}
        currentTurn={gameState.currentTurn}
        currentPhase={gameState.currentPhase}
        playerTeam={currentPlayer?.team}
        playerRole={currentPlayer?.role}
        gameMode={gameState.gameMode}
        timerTokens={gameState.timerTokens}
        remainingGreens={remainingGreens}
        timeRemaining={gameState.timeRemaining}
        isTimerEnabled={
          gameState.timerSettings?.preset !== "off" ||
          (gameState.activeModifier === "haste" &&
            gameState.currentPhase === "operative")
        }
        onSubmitCue={handleSubmitCue}
        showSpymasterToggle={false}
        clueTargetCount={clueTargets.length}
        amHost={amHost}
        onRestartGame={handleRestartGame}
        clueType={gameState.clueType}
        activeModifier={gameState.activeModifier}
        isRTL={gameState.isRTL}
        onLeave={handleLeaveGame}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row w-full max-w-[1600px] mx-auto p-2 lg:px-6 lg:py-2 gap-4 lg:gap-3 min-h-0">
        {/* MOBILE TOP ROW (Teams + Log) - Hidden on lg */}
        {gameState.gameMode === "classic" ? (
          <div className="flex lg:hidden flex-row gap-2 h-48 xs:h-56 sm:h-64 w-full">
            <TeamColumn
              team="blue"
              score={gameState.blueScore}
              operatives={blueOperatives}
              spymasters={blueSpymasters}
              gameMode="classic"
              className="w-[85px] xs:w-[95px] sm:w-[130px] flex-shrink-0"
            />
            <div className="flex-1 min-w-0 flex flex-col bg-[#1a1a1a]/50 rounded-xl overflow-hidden">
                    <GameLog 
                      logs={gameState.gameLog || []} 
                      gameMode={gameState.gameMode}
                      onReportClue={(id, word, name) => {
                        setConfirmModal({
                          isOpen: true,
                          title: "Report Cheat",
                          description: `You are about to report ${name}'s clue "${word}". Do you really think it's a cheat?`,
                          onConfirm: () => {
                            handleReportClue(id);
                            setConfirmModal(null);
                          }
                        });
                      }}
                    />
            </div>
            <TeamColumn
              team="red"
              score={gameState.redScore}
              operatives={redOperatives}
              spymasters={redSpymasters}
              gameMode="classic"
              className="w-[85px] xs:w-[95px] sm:w-[130px] flex-shrink-0"
            />
          </div>
        ) : (
          <div className="flex lg:hidden flex-row gap-2 h-56 w-full">
            <div className="flex-grow min-w-0 flex flex-col bg-[#1a1a1a]/50 rounded-xl overflow-hidden">
              <GameLog
                logs={gameState.gameLog || []}
                gameMode={gameState.gameMode}
              />
            </div>

            <div className="w-[100px] xs:w-[120px] sm:w-[140px] flex-shrink-0 flex flex-col justify-between">
              <div
                className={cn(
                  "flex-1 rounded-xl flex flex-col items-center p-2 shadow-inner border overflow-y-auto scrollbar-none",
                  "bg-lime-500/20 border-lime-500/50",
                )}
              >
                <span className="font-black text-[10px] xs:text-xs sm:text-sm tracking-widest mb-1 text-center sticky top-0 bg-black/40 w-full rounded py-0.5 text-lime-400">
                  {t("side_a")}
                </span>
                <div className="flex flex-col gap-1 w-full mt-1">
                  {[...redOperatives, ...redSpymasters].map((p) => (
                    <div
                      key={p.id}
                      className={cn(
                        "flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5 w-full overflow-hidden transition-opacity",
                        p.connected === false && "opacity-50 grayscale",
                      )}
                    >
                      <img
                        src={
                          p.avatarBase64 ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name)}&backgroundColor=84cc16`
                        }
                        alt={p.name}
                        className="w-4 h-4 xs:w-5 xs:h-5 rounded-full flex-shrink-0"
                      />
                      <span className="text-white font-bold text-[9px] xs:text-[10px] truncate">
                        {p.name} {p.connected === false && t("offline")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className={cn(
                  "flex-1 rounded-xl flex flex-col items-center p-2 shadow-inner border overflow-y-auto scrollbar-none mt-2",
                  "bg-green-500/20 border-green-500/50",
                )}
              >
                <span className="font-black text-[10px] xs:text-xs sm:text-sm tracking-widest mb-1 text-center sticky top-0 bg-black/40 w-full rounded py-0.5 text-green-400">
                  {t("side_b")}
                </span>
                <div className="flex flex-col gap-1 w-full mt-1">
                  {[...blueOperatives, ...blueSpymasters].map((p) => (
                    <div
                      key={p.id}
                      className={cn(
                        "flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5 w-full overflow-hidden transition-opacity",
                        p.connected === false && "opacity-50 grayscale",
                      )}
                    >
                      <img
                        src={
                          p.avatarBase64 ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name)}&backgroundColor=22c55e`
                        }
                        alt={p.name}
                        className="w-4 h-4 xs:w-5 xs:h-5 rounded-full flex-shrink-0"
                      />
                      <span className="text-white font-bold text-[9px] xs:text-[10px] truncate">
                        {p.name} {p.connected === false && t("offline")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DESKTOP LEFT SIDEBAR */}
        <div className="hidden lg:flex lg:flex-col lg:overflow-y-auto lg:max-h-full scrollbar-none">
          <TeamColumn
            team="blue"
            score={gameState.blueScore}
            operatives={blueOperatives}
            spymasters={blueSpymasters}
            gameMode={gameState.gameMode}
          />
        </div>

        {/* CENTER AREA (Grid & Turn Banner) */}
        <div className="flex-1 flex flex-col items-center justify-start min-w-0 min-h-0">
          <div className="w-full text-center py-1 mb-1 lg:py-0.5">
            <h2
              className={`text-lg lg:text-xl xl:text-2xl font-black tracking-widest ${
                gameState.gameMode === "duet"
                  ? gameState.currentTurn === "red"
                    ? "text-lime-400"
                    : "text-green-400"
                  : gameState.currentTurn === "red"
                    ? "text-red-500"
                    : "text-blue-500"
              }`}
            >
              {gameState.gameMode === "classic"
                ? t("teams_turn").replace(
                    "{team}",
                    uiLanguage === "ar"
                      ? gameState.currentTurn === "red"
                        ? t("red_team")
                        : t("blue_team")
                      : gameState.currentTurn.toUpperCase(),
                  )
                : gameState.currentTurn === "red"
                  ? t("side_a_gives_clue")
                  : t("side_b_gives_clue")}
            </h2>
            <div className="text-slate-400 font-bold mt-0.5 text-xs lg:text-xs xl:text-sm">
              {t("playing_as")} {player.name} (
              {gameState.gameMode === "duet"
                ? player.team === "red"
                  ? t("side_a_role")
                  : t("side_b_role")
                : player.role === "operative"
                  ? t("operatives_role")
                  : t("spymasters_role")}
              )
            </div>
          </div>

          {gameState.winner && (
            <div className="mb-4 lg:mb-8 p-4 lg:p-6 glass rounded-2xl text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] z-20 animate-fade-in-up w-full max-w-lg mx-auto">
              {gameState.gameMode === "duet" ? (
                <h2
                  className={`text-2xl lg:text-4xl font-black mb-4 ${gameState.winner === "red" ? "text-lime-500" : "text-red-500"}`}
                >
                  {gameState.winner === "red"
                    ? t("you_win_together")
                    : t("you_lose_together")}
                </h2>
              ) : (
                <h2
                  className={`text-2xl lg:text-4xl font-black mb-4 ${gameState.winner === "red" ? "text-red-500" : "text-blue-500"}`}
                >
                  {t("team_wins").replace(
                    "{team}",
                    uiLanguage === "ar"
                      ? gameState.winner === "red"
                        ? t("red_team")
                        : t("blue_team")
                      : gameState.winner.toUpperCase(),
                  )}
                </h2>
              )}
              <button
                onClick={() => setShowDebrief(true)}
                className="px-5 py-2 lg:px-7 lg:py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 font-black rounded-xl transition-colors mt-4 text-sm tracking-widest uppercase flex items-center gap-2 mx-auto"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10,9 9,9 8,9" />
                </svg>
                View Debrief
              </button>
              {roomPlayers.length > 0 && roomPlayers[0].id === player.id ? (
                <button
                  onClick={handleRestart}
                  className="px-6 py-2 lg:px-8 lg:py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors mt-2"
                >
                  {t("play_again")}
                </button>
              ) : (
                <div className="text-slate-400 font-bold mt-4">
                  {t("waiting_for_host_restart")}
                </div>
              )}
            </div>
          )}

          <div className="flex-1 w-full max-w-4xl mx-auto flex flex-col items-center min-h-0 pb-2 lg:pb-1">
            {/* Sensory Deprivation Warning */}
            {sensoryTimeLeft !== null && sensoryTimeLeft > 0 && (
              <div className="w-full max-w-md bg-purple-950/40 border border-purple-500/50 rounded-xl p-2 mb-2 text-center animate-pulse shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                <span className="block text-xs font-black text-purple-400 uppercase tracking-widest">
                  {t("sensory_deprivation_active")}
                </span>
                <span className="block text-[11px] text-purple-200 mt-1 font-bold">
                  {t("colors_fade_in").replace(
                    "{time}",
                    sensoryTimeLeft.toString(),
                  )}
                </span>
              </div>
            )}
            {/* Lag Spike Warning */}
            {lagSpikeSecondsLeft !== null && lagSpikeSecondsLeft > 0 && (
              <div className="w-full max-w-md bg-yellow-950/40 border border-yellow-500/50 rounded-xl p-2 mb-2 text-center animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.15)]">
                <span className="block text-xs font-black text-yellow-400 uppercase tracking-widest">
                  {t("network_lag_spike")}
                </span>
                <span className="block text-[11px] text-yellow-200 mt-1 font-bold">
                  {t("connection_frozen").replace(
                    "{time}",
                    lagSpikeSecondsLeft.toString(),
                  )}
                </span>
              </div>
            )}
            {/* Intercept Phase Warning */}
            {gameState.activeModifier === "the-intercept" &&
              gameState.modifierState?.interceptPhase && (
                <div className="w-full max-w-md bg-rose-950/40 border border-rose-500/50 rounded-xl p-3 mb-2 text-center animate-pulse shadow-[0_0_20px_rgba(225,29,72,0.3)]">
                  <span className="block text-sm font-black text-rose-400 uppercase tracking-widest">
                    {t("intercept_opportunity").replace(
                      "{time}",
                      gameState.modifierState.interceptTimeLeft?.toString() ||
                        "0",
                    )}
                  </span>
                  <span className="block text-xs text-rose-200 mt-1 font-bold">
                    {currentPlayer?.team !== gameState.currentTurn &&
                    !isSpymaster
                      ? t("click_one_card_steal")
                      : t("enemy_attempting_intercept")}
                  </span>
                </div>
              )}
            {(() => {
              const expectedGuessTeam =
                gameState.gameMode === "duet"
                  ? gameState.currentTurn === "red"
                    ? "blue"
                    : "red"
                  : gameState.currentTurn;

              const isInterceptPhase =
                gameState.activeModifier === "the-intercept" &&
                !!gameState.modifierState?.interceptPhase;
              const enemyTeam =
                gameState.currentTurn === "red" ? "blue" : "red";
              const effectiveGuessTeam = isInterceptPhase
                ? enemyTeam
                : expectedGuessTeam;

              const isLagSpikeActive =
                lagSpikeSecondsLeft !== null && lagSpikeSecondsLeft > 0;

              const isDisabled =
                (gameState.currentPhase === "spymaster" && !isGivingClue) ||
                currentPlayer!.team !== effectiveGuessTeam ||
                (isSpymaster &&
                  gameState.gameMode !== "duet" &&
                  !isGivingClue) ||
                !!gameState.winner ||
                isLagSpikeActive ||
                (isInterceptPhase && currentPlayer!.team === expectedGuessTeam);
              const isScramblePending = !!(
                (showModifierBanner === "dimensional-scramble" ||
                  showModifierBanner === "earthquake") &&
                (isSpymaster || isGivingClue)
              );
              let displayCards = gameState.cards;
              if (isScramblePending) {
                if (gameState.modifierState?.originalCards) {
                  displayCards = gameState.modifierState.originalCards;
                } else if (gameState.modifierState?.originalWords) {
                  displayCards = gameState.cards.map((c, i) => ({
                    ...c,
                    word: gameState.modifierState.originalWords![i] || c.word,
                  }));
                }
              } else if (
                gameState.activeModifier === "hall-of-mirrors" &&
                gameState.modifierState?.illusionCardId
              ) {
                displayCards = displayCards.map((c) =>
                  c.id === gameState.modifierState!.illusionCardId
                    ? { ...c, word: gameState.modifierState!.illusionWord }
                    : c,
                );
              }

              return (
                <div className="flex-1 w-full flex flex-col items-center justify-start gap-2.5 lg:gap-2 min-h-0 transition-all duration-1000">
                  <div className="flex-1 min-h-0 w-full flex items-center justify-center py-1 relative">
                    <Grid
                      cards={displayCards}
                      isSpymaster={
                        (gameState.gameMode === "duet" ||
                          isSpymaster ||
                          !!gameState.winner) &&
                        shouldShowColors
                      }
                      disabled={isDisabled}
                      onCardClick={handleCardClick}
                      playerTeam={currentPlayer!.team}
                      gameMode={gameState.gameMode}
                      isRTL={gameState.isRTL}
                      clueTargets={clueTargets}
                      isGivingClue={isGivingClue || false}
                      highlightedCards={gameState.highlightedCards || {}}
                      players={roomPlayers}
                      currentPlayerId={player?.id}
                      onCardContextMenu={handleCardContextMenu}
                      onGuess={handleGuessCard}
                      activeModifier={gameState.activeModifier}
                      currentPhase={gameState.currentPhase}
                      scrambleActive={
                        scrambleActive &&
                        !!(
                          isSpymaster ||
                          isGivingClue ||
                          gameState.activeModifier === "earthquake"
                        )
                      }
                      isScramblePending={isScramblePending}
                      originalWords={gameState.modifierState?.originalWords}
                      isGuesser={!!isMyTurnToGuess}
                      gachaHighlightId={gachaHighlightCardId}
                      d20FreeReveal={
                        gameState.activeModifier === "d20-roll" &&
                        gameState.modifierState?.canRevealForFree &&
                        isSpymaster
                      }
                      invertedCardIds={
                        gameState.modifierState?.invertedCardIds || []
                      }
                      eatenCardIds={
                        gameState.activeModifier === "nimnims-bite"
                          ? gameState.modifierState?.eatenCardIds
                          : undefined
                      }
                    />

                    {/* Critical Hit 5-Second Timer Overlay */}
                    {isCriticalHitTimerActive && (
                      <div className="absolute inset-0 z-40 bg-black/10 backdrop-blur-[0.5px] flex flex-col items-center justify-center pointer-events-none animate-fade-in">
                        <div className="bg-slate-950/90 border-2 border-red-500 rounded-full w-24 h-24 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.6)] animate-pulse">
                          <span className="text-[10px] font-black uppercase tracking-widest text-red-500 leading-none mb-1">
                            CRITICAL
                          </span>
                          <span className="text-4xl font-black text-white leading-none">
                            {criticalHitTimeLeft}s
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chaos Modifiers Spymaster Action Buttons */}
                  {gameState.currentPhase === "spymaster" &&
                    isSpymaster &&
                    currentPlayer?.team === gameState.currentTurn &&
                    gameState.activeModifier === "d20-roll" &&
                    !gameState.modifierState?.rolled &&
                    !gameState.modifierState?.rollCompleted && (
                      <div className="flex flex-col items-center gap-3 bg-indigo-950/20 p-4 rounded-2xl border border-indigo-500/30 mt-4 z-20">
                        <button
                          onClick={() => {
                            socket?.emit("d20_roll", { roomId });
                          }}
                          className="px-6 py-4 rounded-xl font-black text-sm sm:text-lg tracking-wider border transition-all text-white shrink-0 bg-gradient-to-br from-indigo-500 to-indigo-700 border-indigo-400 shadow-lg shadow-indigo-600/40 hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
                        >
                          {t("roll_the_d20")}
                        </button>
                      </div>
                    )}
                  {gameState.currentPhase === "spymaster" &&
                    isSpymaster &&
                    currentPlayer?.team === gameState.currentTurn &&
                    gameState.activeModifier === "d20-roll" &&
                    gameState.modifierState?.canRevealForFree && (
                      <div className="w-full max-w-md bg-emerald-950/40 border border-emerald-500/50 rounded-xl p-3 mt-4 text-center animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.15)] z-20">
                        <span className="block text-sm font-black text-emerald-400 uppercase tracking-widest">
                          ✨ {t("critical_success")} ✨
                        </span>
                        <span className="block text-xs text-emerald-200 mt-1 font-bold">
                          {t("click_to_reveal_free")}
                        </span>
                      </div>
                    )}

                  {/* Chaos Modifiers Operative Action Buttons */}
                  {gameState.currentPhase === "operative" &&
                    !gameState.winner &&
                    isMyTurnToGuess && (
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-4 z-20">
                        {gameState.activeModifier === "blood-pact" &&
                          gameState.modifierState?.bloodPactStatus ===
                            "available" &&
                          gameState.successfulGuessesThisTurn === 0 && (
                            <button
                              onClick={() => {
                                setIsBloodPactToggleActive(
                                  !isBloodPactToggleActive,
                                );
                                setIsLockToggleActive(false);
                              }}
                              className={cn(
                                "px-4 py-2 rounded-xl font-black text-xs tracking-wider border transition-all cursor-pointer",
                                isBloodPactToggleActive
                                  ? "bg-red-600 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse"
                                  : "bg-red-950/40 text-red-400 border-red-500/40 hover:bg-red-900/30",
                              )}
                            >
                              {isBloodPactToggleActive
                                ? t("click_card_to_reveal")
                                : t("use_blood_pact")}
                            </button>
                          )}

                        {gameState.activeModifier === "mutiny" &&
                          !gameState.modifierState?.mutinyUsed &&
                          gameState.successfulGuessesThisTurn === 0 && (
                            <button
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  title: t("confirm_reject_clue"),
                                  description: t("confirm_reject_clue"),
                                  onConfirm: () => {
                                    socket?.emit("reject_clue", { roomId });
                                    setConfirmModal(null);
                                  },
                                });
                              }}
                              className={cn(
                                "px-4 py-2 rounded-xl font-black text-xs tracking-wider border transition-all cursor-pointer bg-fuchsia-950/40 text-fuchsia-400 border-fuchsia-500/40 hover:bg-fuchsia-900/30 hover:scale-105 active:scale-95",
                              )}
                            >
                              {t("reject_clue_mutiny")}
                            </button>
                          )}

                        {gameState.activeModifier === "gacha-pull" && (
                          <div className="flex flex-col sm:flex-row items-center gap-3 bg-orange-950/20 p-2 sm:p-3 rounded-2xl border border-orange-500/30">
                            <button
                              disabled={!!gameState.modifierState?.gachaPulling}
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  title: t("confirm_gacha_pull"),
                                  description: t("confirm_gacha_pull"),
                                  onConfirm: () => {
                                    socket?.emit("gacha_pull", { roomId });
                                    setConfirmModal(null);
                                  },
                                });
                              }}
                              className={cn(
                                "px-4 py-3 rounded-xl font-black text-xs sm:text-sm tracking-wider border transition-all text-white shrink-0",
                                gameState.modifierState?.gachaPulling
                                  ? "bg-slate-700 border-slate-600 cursor-not-allowed opacity-60"
                                  : "bg-gradient-to-br from-orange-500 to-orange-700 border-orange-400 shadow-lg shadow-orange-600/40 hover:scale-105 active:scale-95 cursor-pointer",
                              )}
                            >
                              {gameState.modifierState?.gachaPulling
                                ? t("pulling_lever")
                                : t("pull_lever_gacha")}
                            </button>

                            {gameState.modifierState?.gachaChances && (
                              <div className="flex flex-wrap items-center justify-center gap-2 bg-black/40 p-2 rounded-xl border border-white/5">
                                {gameState.modifierState.gachaChances
                                  .correct !== undefined && (
                                  <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-lg px-2 py-1 text-center min-w-[3rem]">
                                    <div className="text-emerald-400 font-black text-sm sm:text-base">
                                      {
                                        gameState.modifierState.gachaChances
                                          .correct
                                      }
                                      %
                                    </div>
                                    <div className="text-[9px] font-bold text-emerald-200 uppercase tracking-widest">
                                      {gameState.gameMode === "duet"
                                        ? t("green_color")
                                        : t("correct_guess")}
                                    </div>
                                  </div>
                                )}
                                {gameState.modifierState.gachaChances
                                  .neutral !== undefined && (
                                  <div className="bg-slate-800/80 border border-slate-600 rounded-lg px-2 py-1 text-center min-w-[3rem]">
                                    <div className="text-slate-300 font-black text-sm sm:text-base">
                                      {
                                        gameState.modifierState.gachaChances
                                          .neutral
                                      }
                                      %
                                    </div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                      {t("white_color")}
                                    </div>
                                  </div>
                                )}
                                {gameState.gameMode === "classic" &&
                                  gameState.modifierState.gachaChances.enemy !==
                                    undefined && (
                                    <div className="bg-amber-950/40 border border-amber-500/50 rounded-lg px-2 py-1 text-center min-w-[3rem]">
                                      <div className="text-amber-400 font-black text-sm sm:text-base">
                                        {
                                          gameState.modifierState.gachaChances
                                            .enemy
                                        }
                                        %
                                      </div>
                                      <div className="text-[9px] font-bold text-amber-200 uppercase tracking-widest">
                                        {t("enemy_guess")}
                                      </div>
                                    </div>
                                  )}
                                {gameState.modifierState.gachaChances
                                  .assassin !== undefined && (
                                  <div className="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-center shadow-inner min-w-[3rem]">
                                    <div className="text-white font-black text-sm sm:text-base drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]">
                                      {
                                        gameState.modifierState.gachaChances
                                          .assassin
                                      }
                                      %
                                    </div>
                                    <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                                      {t("black_color")}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {gameState.activeModifier === "shield-wall" &&
                          gameState.modifierState?.shieldActive && (
                            <button
                              onClick={() => {
                                setIsLockToggleActive(!isLockToggleActive);
                                setIsBloodPactToggleActive(false);
                              }}
                              className={cn(
                                "px-4 py-2 rounded-xl font-black text-xs tracking-wider border transition-all cursor-pointer",
                                isLockToggleActive
                                  ? "bg-blue-600 text-white border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse"
                                  : "bg-blue-950/40 text-blue-400 border-blue-500/40 hover:bg-blue-900/30",
                              )}
                            >
                              {isLockToggleActive
                                ? t("click_card_to_shield")
                                : t("lock_card_shield")}
                            </button>
                          )}
                      </div>
                    )}

                  {gameState.currentPhase === "operative" &&
                    !gameState.winner && (
                      <ActiveClueBar
                        activeCue={gameState.activeCue}
                        activeCueNumber={gameState.activeCueNumber}
                        successfulGuessesThisTurn={
                          gameState.successfulGuessesThisTurn
                        }
                        onEndTurn={handleEndTurn}
                        canEndTurn={!isDisabled}
                        onReportClue={handleReportActiveClue}
                      />
                    )}

                  {isGivingClue && (
                    <GiveClueBar
                      onSubmitCue={handleSubmitCue}
                      clueType={gameState.clueType}
                      activeModifier={gameState.activeModifier}
                      clueTargetCount={clueTargets.length}
                      isRTL={gameState.isRTL}
                      modifierState={gameState.modifierState}
                      unrevealedWords={gameState.cards.filter(c => !c.revealed).map(c => c.word)}
                    />
                  )}

                  {gameState.currentPhase === "spymaster" &&
                    !isGivingClue &&
                    !gameState.winner && (
                      <div className="w-full shrink-0 max-w-3xl mx-auto mt-4 sm:mt-6 lg:mt-2 flex items-center justify-center px-2 sm:px-4 animate-fade-in">
                        <div className="flex-1 bg-slate-800/80 rounded-full py-3 sm:py-4 px-4 sm:px-6 flex items-center justify-center shadow-lg border border-slate-700 animate-pulse">
                          <span className="text-slate-400 font-black text-sm sm:text-lg tracking-widest uppercase">
                            {gameState.gameMode === "classic"
                              ? t("waiting_for_spymaster")
                              : gameState.currentTurn === "red"
                                ? t("waiting_for_side_a")
                                : t("waiting_for_side_b")}
                          </span>
                        </div>
                      </div>
                    )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* DESKTOP RIGHT SIDEBAR */}
        <div className="hidden lg:flex flex-col gap-4 lg:w-48 xl:w-56 lg:flex-shrink-0 lg:overflow-y-auto lg:max-h-full scrollbar-none">
          <TeamColumn
            team="red"
            score={gameState.redScore}
            operatives={redOperatives}
            spymasters={redSpymasters}
            gameMode={gameState.gameMode}
          />
          <GameLog
            logs={gameState.gameLog || []}
            gameMode={gameState.gameMode}
            onReportClue={(id, word, name) => {
              setConfirmModal({
                isOpen: true,
                title: "Report Cheat",
                description: `You are about to report ${name}'s clue "${word}". Do you really think it's a cheat?`,
                onConfirm: () => {
                  handleReportClue(id);
                  setConfirmModal(null);
                }
              });
            }}
          />
        </div>
      </div>

      {/* HOST PRANK MENU */}
      {isHost && (
        <div className="fixed bottom-4 left-4 z-50">
          {showPrankMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-2 animate-fade-in origin-bottom-left">
              <div className="text-xs text-slate-400 font-bold mb-2 px-2 uppercase">
                {t("prank_vibrate")}
              </div>
              <div className="max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {roomPlayers
                  .filter((p) => p.id !== player?.id)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handlePrank(p.id)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
                    >
                      <img
                        src={
                          p.avatarBase64 ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name)}&backgroundColor=${p.team === "red" ? "ef4444" : "3b82f6"}`
                        }
                        className="w-6 h-6 rounded-full"
                        alt=""
                      />
                      <span className="truncate text-sm font-bold text-white">
                        {p.name}
                      </span>
                    </button>
                  ))}
                {roomPlayers.length <= 1 && (
                  <div className="text-sm text-slate-500 px-2 italic">
                    {t("nobody_else_here")}
                  </div>
                )}
              </div>
            </div>
          )}
          <button
            onClick={() => setShowPrankMenu(!showPrankMenu)}
            className="w-10 h-10 rounded-full bg-slate-800 border border-slate-600 shadow-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all active:scale-95"
            title="Prank Menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 17v1c0 .5-.5 1-1 1H3c-.5 0-1-.5-1-1v-1" />
              <path d="M6 14v-2c0-3.3 2.7-6 6-6s6 2.7 6 6v2" />
              <path d="M10 3.4a1 1 0 0 1 4 0" />
              <path d="M12 2v1" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </button>
        </div>
      )}
      {/* Chaos Modifier Announcement Banner */}
      {showModifierBanner &&
        (() => {
          const mod = MODIFIERS.find((m) => m.id === showModifierBanner);
          if (!mod) return null;
          const IconComponent =
            MODIFIER_ICONS[mod.icon] || MODIFIER_ICONS["HelpCircle"];
          return (
            <div className="fixed inset-0 bg-slate-950/93 backdrop-blur-none sm:backdrop-blur-sm z-[150] flex items-center justify-center p-8 text-center animate-fade-in">
              <div className="max-w-xl bg-slate-900 border-2 border-red-500/40 rounded-3xl p-8 sm:p-10 shadow-[0_0_60px_rgba(239,68,68,0.3)] animate-reveal-pop flex flex-col items-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-red-500/15 border-2 border-red-500/40 flex items-center justify-center text-red-500 mb-6 animate-pulse">
                  <IconComponent className="w-10 h-10 sm:w-12 sm:h-12" />
                </div>
                <div className="text-red-500 text-xs font-black tracking-widest uppercase mb-2">
                  {t("chaos_modifier_activated")}
                </div>
                <h2 className="text-2xl sm:text-4xl font-black text-white tracking-widest mb-4 uppercase">
                  {uiLanguage === "ar" ? mod.nameAr || mod.name : mod.name}
                </h2>
                <p className="text-slate-300 text-xs sm:text-sm font-bold leading-relaxed">
                  {uiLanguage === "ar"
                    ? mod.descriptionAr || mod.description
                    : mod.description}
                </p>
              </div>
            </div>
          );
        })()}

      {/* Reusable Custom Confirm Modal */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1e1e1e] border-2 border-slate-700/60 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center flex flex-col items-center gap-5 animate-scale-up z-[200]">
            <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white text-2xl font-bold select-none">
              ❓
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase leading-tight">
              {confirmModal.title}
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed font-bold">
              {confirmModal.description}
            </p>
            <div className="flex gap-4 w-full mt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl font-bold text-white transition-colors text-sm uppercase tracking-wider cursor-pointer"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                }}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 text-sm uppercase tracking-wider cursor-pointer"
              >
                {t("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
      {showDebrief && gameState && (
        <PostGameDebrief
          logs={gameState.gameLog || []}
          gameMode={gameState.gameMode}
          onClose={() => setShowDebrief(false)}
        />
      )}

      {showBestClue && gameState && (
        <BestClueShowcase
          logs={gameState.gameLog || []}
          gameMode={gameState.gameMode}
          onDone={() => setShowBestClue(false)}
        />
      )}

      {gameState?.cheatVoteState?.active && (
        <CheatVoteModal
          clueWord={gameState.cheatVoteState.clueWord}
          submitterName={gameState.cheatVoteState.submitterName}
          votes={gameState.cheatVoteState.votes}
          isHost={isHost}
          hasVoted={!!gameState.cheatVoteState.votes[currentPlayer?.id || '']}
          onVote={handleVoteCheat}
          onResolve={handleResolveCheat}
          totalEligibleVoters={roomPlayers.length - 1} // Host doesn't vote
        />
      )}
    </div>
  );
}
