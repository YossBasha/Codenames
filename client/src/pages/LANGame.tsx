import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGameContext } from "../context/GameContext";
import type { GameState } from "../../../shared/types";
import Grid from "../components/Grid";
import TopBar from "../components/TopBar";
import TeamColumn from "../components/TeamColumn";
import GameLog from "../components/GameLog";
import ActiveClueBar from "../components/ActiveClueBar";
import { cn } from "../utils";
import type { Player } from "../../../shared/types";
import { playCardRevealSfx } from "../utils/sfx";

export default function LANGame() {
  const navigate = useNavigate();
  const { player, roomId, socket } = useGameContext();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<Player[]>([]);
  const roomPlayersRef = useRef<Player[]>([]);
  const [clueTargets, setClueTargets] = useState<number[]>([]);
  const [hostDisconnected, setHostDisconnected] = useState(false);
  const [showPrankMenu, setShowPrankMenu] = useState(false);

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
    };

    socket.on("game_update", handleGameUpdate);
    socket.on("room_update", handleRoomUpdate);
    socket.on("timer_tick", async (timeRemaining: number) => {
      if (timeRemaining <= 10 && timeRemaining > 0) {
        const { triggerHeartbeatVibration } = await import("../utils/haptics");
        triggerHeartbeatVibration(timeRemaining);
      }
      setGameState(prev => prev ? { ...prev, timeRemaining } : null);
    });
    
    socket.on("trigger_prank", async ({ targetPlayerId }: { targetPlayerId: string }) => {
      if (player?.id === targetPlayerId) {
        const { triggerPrankVibration } = await import("../utils/haptics");
        triggerPrankVibration();
      }
    });

    socket.on("return_to_lobby", () => {
      // Reconstruct lobby URL from the socket connection info.
      // LANGame has no URL params, so we derive them from the live socket.
      const lobbyParams = new URLSearchParams();
      
      // Check if we're the host (first player in the room)
      const latestPlayers = roomPlayersRef.current;
      const amHostCheck = latestPlayers.length > 0 && 
        ((player?.sessionId && latestPlayers[0].sessionId === player?.sessionId) || latestPlayers[0].id === player?.id);

      // Always extract port from the live socket connection
      try {
        const socketUrl = new URL((socket.io as any).uri);
        lobbyParams.set('port', socketUrl.port);
        if (!amHostCheck) {
          const connectedIp = socketUrl.hostname;
          if (connectedIp && connectedIp !== '127.0.0.1') {
            lobbyParams.set('ip', connectedIp);
          }
        }
      } catch (_) {}

      if (amHostCheck) lobbyParams.set('host', 'true');
      if (roomId) lobbyParams.set('room', roomId);

      navigate(`/lan-lobby?${lobbyParams.toString()}`);
    });

    socket.on("host_disconnected", () => {
      setHostDisconnected(true);
      setTimeout(() => navigate('/'), 4000);
    });

    socket.on("disconnect", () => {
      setHostDisconnected(true);
      setTimeout(() => navigate('/'), 4000);
    });

    // Request fresh room state immediately upon mounting
    socket.emit("join_room", { roomId, player });

    return () => {
      socket.off("game_update", handleGameUpdate);
      socket.off("room_update", handleRoomUpdate);
      socket.off("timer_tick");
      socket.off("return_to_lobby");
      socket.off("host_disconnected");
      socket.off("disconnect");
    };
  }, [socket, roomId, player, navigate]);

  // Ensure we use the freshest player state synced from the server (e.g. after randomize teams)
  const currentPlayer = roomPlayers.find(p => p.id === player?.id) || player;

  const lastLogLength = useRef(0);
  useEffect(() => {
    if (gameState?.gameLog) {
      const currentLength = gameState.gameLog.length;
      if (currentLength > lastLogLength.current && lastLogLength.current !== 0) {
        const newLog = gameState.gameLog[currentLength - 1];
        if (newLog.type === 'guess') {
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
    }
    previousWinner.current = gameState?.winner || null;
  }, [gameState?.winner]);

  const handlePrank = (targetPlayerId: string) => {
    if (!socket || !roomId) return;
    socket.emit("prank_vibrate", { roomId, targetPlayerId });
    setShowPrankMenu(false);
  };

  const isGivingClue = gameState && !gameState.winner && 
    gameState.currentPhase === 'spymaster' && 
    (
      (gameState.gameMode === 'classic' && currentPlayer?.team === gameState.currentTurn && currentPlayer?.role === 'spymaster') ||
      (gameState.gameMode === 'duet' && currentPlayer?.team === gameState.currentTurn)
    );

  const handleCardClick = (id: number) => {
    if (!gameState || gameState.winner || !socket || !roomId) return;
    
    if (isGivingClue) {
      const card = gameState.cards.find(c => c.id === id);
      if (!card) return;
      
      let isValidClueTarget = false;
      if (gameState.gameMode === 'classic') {
        isValidClueTarget = card.type === currentPlayer?.team && !card.revealed;
      } else {
        if (currentPlayer?.team === 'red') {
          isValidClueTarget = card.duetTypeA === 'green' && !card.revealedByB;
        } else if (currentPlayer?.team === 'blue') {
          isValidClueTarget = card.duetTypeB === 'green' && !card.revealedByA;
        }
      }
      
      if (!isValidClueTarget) return;

      setClueTargets(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
      return;
    }

    if (gameState.gameMode !== "duet" && currentPlayer?.role === "spymaster") return; // Spymasters can't guess in classic
    if (gameState.currentPhase === "spymaster") return; // Nobody can guess in spymaster phase

    socket.emit("highlight_card", { roomId, cardId: id });
  };

  const handleGuessCard = (id: number) => {
    if (!gameState || gameState.winner || !socket || !roomId) return;
    socket.emit("guess_card", { roomId, cardId: id });
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
        Loading Game...
      </div>
    );

  const isSpymaster = player.role === "spymaster";

  const bgClass = !gameState
    ? "bg-slate-900"
    : gameState.winner === "red"
      ? (gameState.gameMode === 'duet' ? "bg-lime-950" : "bg-red-950")
      : gameState.winner === "blue"
        ? "bg-blue-950"
        : gameState.winner === "spectator" // Duet loss
          ? "bg-slate-950"
          : gameState.currentTurn === "red"
            ? (gameState.gameMode === 'duet' ? "bg-lime-950" : "bg-[#2a1215]")
            : (gameState.gameMode === 'duet' ? "bg-green-950" : "bg-[#0e1a30]");

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
  if (gameState.gameMode === 'duet') {
    let distinctGreensFound = 0;
    gameState.cards.forEach(c => {
      const correctForB = c.duetTypeA === 'green' && c.revealedByB;
      const correctForA = c.duetTypeB === 'green' && c.revealedByA;
      if (correctForA || correctForB) distinctGreensFound++;
    });
    remainingGreens = Math.max(0, 15 - distinctGreensFound);
  }

  const amHost = roomPlayers.length > 0 && 
    ((player?.sessionId && roomPlayers[0].sessionId === player?.sessionId) || roomPlayers[0].id === player?.id);

  const handleRestartGame = () => {
    if (window.confirm("Are you sure you want to end the current game and return everyone to the lobby?")) {
      socket?.emit('play_again', { roomId });
    }
  };

  return (
    <div
      className={cn(`min-h-screen lg:h-screen lg:max-h-screen flex flex-col relative overflow-x-hidden lg:overflow-hidden transition-colors duration-1000`, bgClass)}
    >
      {/* Host Disconnected Overlay */}
      {hostDisconnected && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1e1e1e] border-2 border-red-500/40 rounded-3xl p-8 max-w-md w-full shadow-[0_0_60px_rgba(239,68,68,0.2)] text-center flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-white tracking-wide">HOST DISCONNECTED</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              The host has left the game. You will be returned to the main menu shortly.
            </p>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-red-500 rounded-full animate-shrink-bar" />
            </div>
            <button
              onClick={() => navigate('/')}
              className="mt-1 px-8 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-2xl font-bold text-white transition-colors text-sm tracking-widest"
            >
              RETURN NOW
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
        isTimerEnabled={gameState.timerSettings?.preset !== 'off'}
        onSubmitCue={handleSubmitCue}
        showSpymasterToggle={false}
        clueTargetCount={clueTargets.length}
        amHost={amHost}
        onRestartGame={handleRestartGame}
        clueType={gameState.clueType}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row w-full max-w-[1600px] mx-auto p-2 lg:px-6 lg:py-2 gap-4 lg:gap-3 lg:min-h-0">
        {/* MOBILE TOP ROW (Teams + Log) - Hidden on lg */}
        {gameState.gameMode === 'classic' ? (
          <div className="flex lg:hidden flex-row gap-2 h-48 xs:h-56 sm:h-64 w-full">
            <TeamColumn
              team="blue"
              score={gameState.blueScore}
              operatives={blueOperatives}
              spymasters={blueSpymasters}
              gameMode="classic"
              className="w-[80px] xs:w-[90px] sm:w-[130px] flex-shrink-0"
            />
            <div className="flex-1 min-w-0 flex flex-col bg-[#1a1a1a]/50 rounded-xl overflow-hidden">
              <GameLog logs={gameState.gameLog || []} gameMode="classic" />
            </div>
            <TeamColumn
              team="red"
              score={gameState.redScore}
              operatives={redOperatives}
              spymasters={redSpymasters}
              gameMode="classic"
              className="w-[80px] xs:w-[90px] sm:w-[130px] flex-shrink-0"
            />
          </div>
        ) : (
          <div className="flex lg:hidden flex-row gap-2 h-64 w-full">
            <div className="flex-1 min-w-0 flex flex-col">
              <GameLog logs={gameState.gameLog || []} gameMode={gameState.gameMode} />
            </div>
            
            <div className="w-[100px] xs:w-[120px] sm:w-[140px] flex-shrink-0 flex flex-col justify-between">
              <div className={cn(
                "flex-1 rounded-xl flex flex-col items-center p-2 shadow-inner border overflow-y-auto scrollbar-none",
                "bg-lime-500/20 border-lime-500/50"
              )}>
                <span className="font-black text-[10px] xs:text-xs sm:text-sm tracking-widest mb-1 text-center sticky top-0 bg-black/40 w-full rounded py-0.5 text-lime-400">
                  SIDE A
                </span>
                <div className="flex flex-col gap-1 w-full mt-1">
                  {[...redOperatives, ...redSpymasters].map(p => (
                      <div key={p.id} className={cn(
                        "flex items-center gap-1 bg-black/40 p-1 lg:p-1.5 rounded-lg border border-white/5 w-full overflow-hidden transition-opacity",
                        p.connected === false && "opacity-50 grayscale"
                      )}>
                        <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name)}&backgroundColor=84cc16`} alt={p.name} className="w-4 h-4 xs:w-5 xs:h-5 rounded-full flex-shrink-0" />
                        <span className="text-white font-bold text-[9px] xs:text-[10px] truncate">{p.name} {p.connected === false && "(Offline)"}</span>
                      </div>
                  ))}
                </div>
              </div>
              
              <div className={cn(
                "flex-1 rounded-xl flex flex-col items-center p-2 shadow-inner border overflow-y-auto scrollbar-none mt-2",
                "bg-green-500/20 border-green-500/50"
              )}>
                <span className="font-black text-[10px] xs:text-xs sm:text-sm tracking-widest mb-1 text-center sticky top-0 bg-black/40 w-full rounded py-0.5 text-green-400">
                  SIDE B
                </span>
                <div className="flex flex-col gap-1 w-full mt-1">
                  {[...blueOperatives, ...blueSpymasters].map(p => (
                    <div key={p.id} className={cn(
                      "flex items-center gap-1 bg-black/40 p-1 lg:p-1.5 rounded-lg border border-white/5 w-full overflow-hidden transition-opacity",
                      p.connected === false && "opacity-50 grayscale"
                    )}>
                      <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name)}&backgroundColor=22c55e`} alt={p.name} className="w-4 h-4 xs:w-5 xs:h-5 rounded-full flex-shrink-0" />
                      <span className="text-white font-bold text-[9px] xs:text-[10px] truncate">{p.name} {p.connected === false && "(Offline)"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DESKTOP LEFT SIDEBAR */}
        <div className="hidden lg:flex">
          <TeamColumn
            team="blue"
            score={gameState.blueScore}
            operatives={blueOperatives}
            spymasters={blueSpymasters}
            gameMode={gameState.gameMode}
          />
        </div>

        {/* CENTER AREA (Grid & Turn Banner) */}
        <div className="flex-1 flex flex-col items-center justify-start min-w-0 lg:min-h-0">
          <div className="w-full text-center py-2 mb-2 lg:mb-2 lg:py-1">
            <h2
              className={`text-xl lg:text-3xl font-black tracking-widest ${
                gameState.gameMode === 'duet'
                  ? (gameState.currentTurn === 'red' ? "text-lime-400" : "text-green-400")
                  : (gameState.currentTurn === "red" ? "text-red-500" : "text-blue-500")
              }`}
            >
              {gameState.gameMode === 'classic' ? (
                `${gameState.currentTurn.toUpperCase()} TEAM'S TURN`
              ) : (
                gameState.currentTurn === 'red' ? "SIDE A GIVES CLUE -> SIDE B GUESSES" : "SIDE B GIVES CLUE -> SIDE A GUESSES"
              )}
            </h2>
            <div className="text-slate-400 font-bold mt-1 text-sm lg:text-base">
              Playing as: {player.name} ({gameState.gameMode === 'duet' ? (player.team === 'red' ? 'Side A' : 'Side B') : player.role})
            </div>
          </div>

          {gameState.winner && (
            <div className="mb-4 lg:mb-8 p-4 lg:p-6 glass rounded-2xl text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] z-20 animate-fade-in-up w-full max-w-lg mx-auto">
              {gameState.gameMode === 'duet' ? (
                <h2 className={`text-2xl lg:text-4xl font-black mb-4 ${gameState.winner === 'red' ? "text-lime-500" : "text-red-500"}`}>
                  {gameState.winner === 'red' ? "YOU WIN TOGETHER!" : "YOU LOSE TOGETHER!"}
                </h2>
              ) : (
                <h2 className={`text-2xl lg:text-4xl font-black mb-4 ${gameState.winner === "red" ? "text-red-500" : "text-blue-500"}`}>
                  {gameState.winner.toUpperCase()} TEAM WINS!
                </h2>
              )}
              {roomPlayers.length > 0 && roomPlayers[0].id === player.id ? (
                <button
                  onClick={handleRestart}
                  className="px-6 py-2 lg:px-8 lg:py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors mt-4"
                >
                  Play Again
                </button>
              ) : (
                <div className="text-slate-400 font-bold mt-6">Waiting for host to restart...</div>
              )}
            </div>
          )}

          <div className="w-full max-w-4xl mx-auto flex-1 flex justify-center pb-8 lg:pb-0 lg:min-h-0">
            {(() => {
              const expectedGuessTeam = gameState.gameMode === 'duet' ? 
                (gameState.currentTurn === 'red' ? 'blue' : 'red') : 
                gameState.currentTurn;
                
              const isDisabled = (gameState.currentPhase === 'spymaster' && !isGivingClue) || 
                                 currentPlayer!.team !== expectedGuessTeam || 
                                 (isSpymaster && gameState.gameMode !== 'duet' && !isGivingClue) ||
                                 !!gameState.winner;
              return (
                <div className="w-full flex flex-col items-center transition-all duration-1000">
                  <Grid
                    cards={gameState.cards}
                    isSpymaster={gameState.gameMode === 'duet' || isSpymaster || !!gameState.winner}
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
                  />
                  {gameState.currentPhase === 'operative' && !gameState.winner && (
                    <ActiveClueBar 
                      activeCue={gameState.activeCue}
                      activeCueNumber={gameState.activeCueNumber}
                      successfulGuessesThisTurn={gameState.successfulGuessesThisTurn}
                      onEndTurn={handleEndTurn}
                      canEndTurn={!isDisabled}
                    />
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* DESKTOP RIGHT SIDEBAR */}
        <div className="hidden lg:flex flex-col gap-4 lg:w-48 xl:w-56 lg:flex-shrink-0">
          <TeamColumn
            team="red"
            score={gameState.redScore}
            operatives={redOperatives}
            spymasters={redSpymasters}
            gameMode={gameState.gameMode}
          />
          <GameLog logs={gameState.gameLog || []} gameMode={gameState.gameMode} />
        </div>
      </div>

      {/* HOST PRANK MENU */}
      {isHost && (
        <div className="fixed bottom-4 left-4 z-50">
          {showPrankMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-2 animate-fade-in origin-bottom-left">
              <div className="text-xs text-slate-400 font-bold mb-2 px-2 uppercase">Prank Vibrate</div>
              <div className="max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {roomPlayers.filter(p => p.id !== player?.id).map(p => (
                  <button
                    key={p.id}
                    onClick={() => handlePrank(p.id)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
                  >
                    <img 
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name)}&backgroundColor=${p.team === 'red' ? 'ef4444' : '3b82f6'}`} 
                      className="w-6 h-6 rounded-full" 
                      alt="" 
                    />
                    <span className="truncate text-sm font-bold text-white">{p.name}</span>
                  </button>
                ))}
                {roomPlayers.length <= 1 && (
                  <div className="text-sm text-slate-500 px-2 italic">Nobody else here...</div>
                )}
              </div>
            </div>
          )}
          <button
            onClick={() => setShowPrankMenu(!showPrankMenu)}
            className="w-10 h-10 rounded-full bg-slate-800 border border-slate-600 shadow-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all active:scale-95"
            title="Prank Menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17v1c0 .5-.5 1-1 1H3c-.5 0-1-.5-1-1v-1"/><path d="M6 14v-2c0-3.3 2.7-6 6-6s6 2.7 6 6v2"/><path d="M10 3.4a1 1 0 0 1 4 0"/><path d="M12 2v1"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
