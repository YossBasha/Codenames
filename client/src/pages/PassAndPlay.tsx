import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useGameContext } from "../context/GameContext";
import { generateGrid, generateDuetGrid } from "../../../shared/gameLogic";
import type { GameState, CustomWordWeight, TimerSettings, Team } from "../../../shared/types";
import Grid from "../components/Grid";
import TopBar from "../components/TopBar";
import ActiveClueBar from "../components/ActiveClueBar";
import { cn } from "../utils";
import GameSettingsPanel from "../components/GameSettingsPanel";
import { playCardRevealSfx, playMenuClickSfx, playMenuHoverSfx } from "../utils/sfx";

type LocalPhase = 'Setup' | 'Spymaster_Setup' | 'Spymaster_Input' | 'Operative_Handoff' | 'Operative_Guessing';

function getNextTurnDuetLocal(currentTurn: Team, cards: any[]): 'red' | 'blue' {
  let nextTurn: 'red' | 'blue' = currentTurn === 'red' ? 'blue' : 'red';
  if (nextTurn === 'red') {
    const aRemaining = cards.filter(c => c.duetTypeA === 'green' && !c.revealedByB).length;
    if (aRemaining === 0) return 'blue';
  } else {
    const bRemaining = cards.filter(c => c.duetTypeB === 'green' && !c.revealedByA).length;
    if (bRemaining === 0) return 'red';
  }
  return nextTurn;
}

export default function PassAndPlay() {
  const navigate = useNavigate();
  const { language, setLanguage } = useGameContext();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [localPhase, setLocalPhase] = useState<LocalPhase>('Setup');
  const [clueTargets, setClueTargets] = useState<number[]>([]);

  // Setup State
  const [gameMode, setGameMode] = useState<'classic'|'duet'>('classic');
  const [selectedPacks, setSelectedPacks] = useState<string[]>(['classic']);
  const [customWordsText, setCustomWordsText] = useState('');
  const [customWordWeight, setCustomWordWeight] = useState<CustomWordWeight>('none');
  const [timerSettings, setTimerSettings] = useState<TimerSettings>({
    preset: 'off',
    spymasterTime: 0,
    operativeTime: 0,
    extraFirstClueTime: 0
  });

  const customWordsArray = useMemo(() => {
    if (!customWordsText.trim()) return [];
    const lines = customWordsText.split('\n');
    const cleaned = lines.map(line => line.trim().toUpperCase()).filter(line => line.length > 0);
    return Array.from(new Set(cleaned));
  }, [customWordsText]);

  // Timer Ref
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = (state: GameState) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (state.timerSettings.preset === 'off') return;

    let duration = 0;
    if (state.currentPhase === 'spymaster') {
      duration = state.timerSettings.spymasterTime;
      if (state.isFirstTurnOfGame) {
        duration += state.timerSettings.extraFirstClueTime;
      }
    } else {
      duration = state.timerSettings.operativeTime;
    }

    setGameState(prev => prev ? { ...prev, timeRemaining: duration } : null);

    timerRef.current = setInterval(() => {
      setGameState(prev => {
        if (!prev || prev.winner || localPhase === 'Spymaster_Setup' || localPhase === 'Operative_Handoff') {
          return prev; // Pause timer during handoffs
        }
        
        const newTime = prev.timeRemaining - 1;
        if (newTime <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          
          // Auto turn-end logic
          if (prev.currentPhase === 'spymaster') {
            setLocalPhase('Operative_Handoff');
            return {
              ...prev,
              activeCue: "",
              activeCueNumber: 0,
              currentPhase: 'operative',
              successfulGuessesThisTurn: 0,
              timeRemaining: prev.timerSettings.operativeTime
            };
          } else {
            setLocalPhase('Spymaster_Setup');
            let nextTurn: 'red' | 'blue' = prev.gameMode === 'duet' 
              ? getNextTurnDuetLocal(prev.currentTurn, prev.cards)
              : (prev.currentTurn === 'red' ? 'blue' : 'red');
            let winner: Team | null = prev.winner;
            let tokens = prev.timerTokens;
            
            if (prev.gameMode === 'duet') {
              tokens--;
              if (tokens <= 0) winner = 'spectator'; // Duet loss
            }
            
            return {
              ...prev,
              currentTurn: nextTurn as 'red'|'blue',
              currentPhase: 'spymaster',
              activeCue: null,
              activeCueNumber: null,
              successfulGuessesThisTurn: 0,
              timerTokens: tokens,
              winner
            };
          }
        }
        return { ...prev, timeRemaining: newTime };
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Restart timer when phase actually starts (user dismisses overlay)
  useEffect(() => {
    if (gameState && !gameState.winner) {
      if (localPhase === 'Spymaster_Input' || localPhase === 'Operative_Guessing') {
        startTimer(gameState);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localPhase]);

  const handleStartGame = () => {
    const { cards, startingTeam } = gameMode === 'duet'
      ? generateDuetGrid(language, selectedPacks, customWordsArray, customWordWeight)
      : generateGrid(language, selectedPacks, customWordsArray, customWordWeight);

    const initialState: GameState = {
      gameMode,
      timerSettings,
      isFirstTurnOfGame: true,
      timeRemaining: timerSettings.spymasterTime + timerSettings.extraFirstClueTime,
      timerTokens: gameMode === 'duet' ? 9 : 0,
      cards,
      currentTurn: startingTeam,
      currentPhase: "spymaster", 
      activeCue: null,
      activeCueNumber: null,
      successfulGuessesThisTurn: 0,
      winner: null,
      redScore: startingTeam === "red" ? 9 : 8,
      blueScore: startingTeam === "blue" ? 9 : 8,
      language,
      gameLog: [],
    };

    setGameState(initialState);
    setLocalPhase('Spymaster_Setup');
  };

  const handleCardClick = (id: number) => {
    if (!gameState || gameState.winner) return;

    if (localPhase === 'Spymaster_Input') {
      setClueTargets(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
      return;
    }

    if (localPhase !== "Operative_Guessing") return;

    const maxGuesses = (gameState.activeCueNumber || 0) + 1;
    if (gameState.successfulGuessesThisTurn >= maxGuesses) return;

    const newCards = [...gameState.cards];
    const cardIndex = newCards.findIndex((c) => c.id === id);
    if (cardIndex === -1) return;

    const card = newCards[cardIndex];
    let nextTurn: Team = gameState.currentTurn;
    let newPhase: LocalPhase = localPhase;
    let newCue = gameState.activeCue;
    let newCueNum = gameState.activeCueNumber;
    let newGuesses = gameState.successfulGuessesThisTurn;
    let newRedScore = gameState.redScore;
    let newBlueScore = gameState.blueScore;
    let winner: Team | null = gameState.winner;
    let newTokens = gameState.timerTokens;

    if (gameState.gameMode === 'duet') {
      const expectedGuessTeam = gameState.currentTurn === 'red' ? 'blue' : 'red';
      const alreadyRevealed = expectedGuessTeam === 'blue' ? card.revealedByB : card.revealedByA;
      if (alreadyRevealed) return;

      const keyType = expectedGuessTeam === 'blue' ? card.duetTypeA : card.duetTypeB;
      
      if (expectedGuessTeam === 'blue') card.revealedByB = true;
      else card.revealedByA = true;
      
      card.revealed = true;
      card.type = keyType!; 
      playCardRevealSfx(keyType as any);

      const endTurnDuet = () => {
        nextTurn = getNextTurnDuetLocal(gameState.currentTurn, newCards);
        newPhase = "Spymaster_Setup";
        newCue = null;
        newCueNum = null;
        newGuesses = 0;
        newTokens--;
        if (newTokens <= 0) winner = 'spectator';
      };

      if (keyType === 'assassin') {
        winner = 'spectator';
      } else if (keyType === 'neutral') {
        endTurnDuet();
      } else if (keyType === 'green') {
        newGuesses++;
        let foundGreens = 0;
        newCards.forEach(c => {
          if (c.duetTypeA === 'green' && c.revealedByB) foundGreens++;
          if (c.duetTypeB === 'green' && c.revealedByA) foundGreens++;
        });
        
        if (foundGreens >= 15) {
          winner = 'red'; // Win
        } else {
          let remainingTargetsForCurrentTeam = 0;
          if (expectedGuessTeam === 'blue') {
            remainingTargetsForCurrentTeam = newCards.filter(c => c.duetTypeA === 'green' && !c.revealedByB).length;
          } else {
            remainingTargetsForCurrentTeam = newCards.filter(c => c.duetTypeB === 'green' && !c.revealedByA).length;
          }

          if (remainingTargetsForCurrentTeam === 0 || newGuesses >= maxGuesses) {
            endTurnDuet();
          }
        }
      }

    } else {
      if (card.revealed) return;
      card.revealed = true;
      playCardRevealSfx(card.type as any);

      const endTurn = () => {
        nextTurn = gameState.currentTurn === "red" ? "blue" : "red";
        newPhase = "Spymaster_Setup";
        newCue = null;
        newCueNum = null;
        newGuesses = 0;
      };

      if (card.type === "assassin") {
        winner = gameState.currentTurn === "red" ? "blue" : "red";
      } else if (card.type === "red") {
        newRedScore--;
        if (newRedScore === 0) {
          winner = "red";
        } else if (gameState.currentTurn === "blue") {
          endTurn();
        } else {
          newGuesses++;
          if (newGuesses >= maxGuesses) endTurn();
        }
      } else if (card.type === "blue") {
        newBlueScore--;
        if (newBlueScore === 0) {
          winner = "blue";
        } else if (gameState.currentTurn === "red") {
          endTurn();
        } else {
          newGuesses++;
          if (newGuesses >= maxGuesses) endTurn();
        }
      } else if (card.type === "neutral") {
        endTurn();
      }
    }

    setGameState(prev => prev ? ({
      ...prev,
      cards: newCards,
      currentTurn: nextTurn,
      activeCue: newCue,
      activeCueNumber: newCueNum,
      successfulGuessesThisTurn: newGuesses,
      redScore: newRedScore,
      blueScore: newBlueScore,
      timerTokens: newTokens,
      winner,
      isFirstTurnOfGame: false,
      currentPhase: newPhase === 'Spymaster_Setup' ? 'spymaster' : 'operative'
    }) : null);
    
    setLocalPhase(newPhase);
  };

  const handleSubmitCue = (cue: string, number: number) => {
    if (!gameState || localPhase !== 'Spymaster_Input') return;
    setGameState(prev => prev ? ({
      ...prev,
      activeCue: cue,
      activeCueNumber: number,
      successfulGuessesThisTurn: 0,
      currentPhase: 'operative'
    }) : null);
    setLocalPhase('Operative_Handoff');
    setClueTargets([]);
  };

  const handleEndTurn = () => {
    if (!gameState || gameState.winner || localPhase !== "Operative_Guessing") return;
    
    setGameState(prev => {
      if (!prev) return null;
      let newTokens = prev.timerTokens;
      let winner: Team | null = prev.winner;
      if (prev.gameMode === 'duet') {
        newTokens--;
        if (newTokens <= 0) winner = 'spectator';
      }
      return {
        ...prev,
        currentTurn: prev.gameMode === 'duet' 
          ? getNextTurnDuetLocal(prev.currentTurn, prev.cards)
          : (prev.currentTurn === "red" ? "blue" : "red"),
        activeCue: null,
        activeCueNumber: null,
        successfulGuessesThisTurn: 0,
        isFirstTurnOfGame: false,
        currentPhase: 'spymaster',
        timerTokens: newTokens,
        winner
      };
    });
    setLocalPhase("Spymaster_Setup");
  };

  if (localPhase === 'Setup') {
    return (
      <div className="min-h-screen bg-[#121212] flex flex-col p-4 sm:p-6 font-sans text-white">
        <div className="flex items-center mb-6">
          <button onMouseEnter={playMenuHoverSfx} onClick={() => { playMenuClickSfx(); navigate('/'); }} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          </button>
          <h1 className="ml-4 text-xl font-black tracking-widest text-slate-200">PASS & PLAY SETUP</h1>
        </div>
        
        <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col">
          <div className="bg-[#242424] rounded-3xl p-6 lg:p-8 flex flex-col gap-6 shadow-xl flex-1 relative">
            <GameSettingsPanel
              isHost={true}
              gameMode={gameMode}
              setGameMode={setGameMode}
              selectedPacks={selectedPacks}
              setSelectedPacks={setSelectedPacks}
              timerSettings={timerSettings}
              setTimerSettings={setTimerSettings}
              customWordsText={customWordsText}
              setCustomWordsText={setCustomWordsText}
              customWordWeight={customWordWeight}
              setCustomWordWeight={setCustomWordWeight}
              customWordsArray={customWordsArray}
              language={language}
              setLanguage={setLanguage}
            />
          </div>
          
          <div className="mt-6">
            <button 
              onMouseEnter={playMenuHoverSfx}
              onClick={() => { playMenuClickSfx(); handleStartGame(); }}
              className="w-full py-4 bg-[#22c55e] hover:bg-[#16a34a] rounded-full font-black text-2xl tracking-widest text-white shadow-[0_10px_0_#15803d] hover:translate-y-1 hover:shadow-[0_5px_0_#15803d] transition-all"
            >
              START GAME
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) return <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center">Loading...</div>;

  const bgClass = gameState.winner === "red"
      ? (gameState.gameMode === 'duet' ? "bg-green-950" : "bg-red-950")
      : gameState.winner === "blue"
        ? "bg-blue-950"
        : gameState.winner === "spectator" 
          ? "bg-slate-950"
          : gameState.currentTurn === "red"
            ? (gameState.gameMode === 'duet' ? "bg-green-950" : "bg-[#2a1215]")
            : (gameState.gameMode === 'duet' ? "bg-teal-950" : "bg-[#0e1a30]");

  const mappedCurrentPhase = localPhase === 'Spymaster_Input' ? 'spymaster' : 'operative';
  const isSpymasterVisible = localPhase === 'Spymaster_Input';

  // Determine expected guess team for TopBar
  const expectedGuessTeam = gameState.gameMode === 'duet' ? 
    (gameState.currentTurn === 'red' ? 'blue' : 'red') : 
    gameState.currentTurn;

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

  return (
    <div className={`min-h-screen ${bgClass} transition-colors duration-1000 flex flex-col relative overflow-hidden`}>
      <TopBar
        redScore={gameState.redScore}
        blueScore={gameState.blueScore}
        currentTurn={gameState.currentTurn}
        currentPhase={mappedCurrentPhase}
        playerTeam={mappedCurrentPhase === 'spymaster' ? gameState.currentTurn : expectedGuessTeam}
        playerRole={mappedCurrentPhase === 'spymaster' ? "spymaster" : "operative"}
        gameMode={gameState.gameMode}
        timerTokens={gameState.timerTokens}
        remainingGreens={remainingGreens}
        timeRemaining={gameState.timeRemaining}
        isTimerEnabled={gameState.timerSettings.preset !== 'off'}
        onSubmitCue={handleSubmitCue}
        showSpymasterToggle={false} 
        isSpymaster={isSpymasterVisible}
        clueTargetCount={clueTargets.length}
      />

      <div className="flex-1 flex flex-col items-center p-4 pt-8">
        {gameState.winner && (
          <div className="mb-8 p-6 glass rounded-2xl text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] z-20 animate-fade-in-up">
            {gameState.gameMode === 'duet' ? (
              <h2 className={`text-4xl font-black mb-4 ${gameState.winner === 'red' ? "text-green-500" : "text-red-500"}`}>
                {gameState.winner === 'red' ? "YOU WIN TOGETHER!" : "YOU LOSE TOGETHER!"}
              </h2>
            ) : (
              <h2 className={`text-4xl font-black mb-4 ${gameState.winner === "red" ? "text-red-500" : "text-blue-500"}`}>
                {gameState.winner.toUpperCase()} TEAM WINS!
              </h2>
            )}
            <button
              onClick={() => { setGameState(null); setLocalPhase('Setup'); }}
              className="px-8 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Play Again
            </button>
          </div>
        )}

        {/* Phase Overlays */}
        {localPhase === 'Spymaster_Setup' && !gameState.winner && (
          <div
            className="absolute inset-0 z-40 bg-slate-900/90 backdrop-blur-xl flex items-center justify-center cursor-pointer p-8 text-center"
            onClick={() => setLocalPhase('Spymaster_Input')}
          >
            <div className="max-w-lg glass p-10 rounded-3xl animate-fade-in">
              <h2 className={cn("text-4xl font-black mb-4", 
                gameState.gameMode === 'duet'
                  ? (gameState.currentTurn === 'red' ? "text-green-400" : "text-teal-400")
                  : (gameState.currentTurn === 'red' ? "text-red-500" : "text-blue-500")
              )}>
                {gameState.gameMode === 'classic' ? `${gameState.currentTurn.toUpperCase()} SPYMASTER` : (gameState.currentTurn === 'red' ? "SIDE A GIVES CLUE" : "SIDE B GIVES CLUE")}
              </h2>
              <p className="text-2xl font-bold mb-8">Grab the device.</p>
              <p className="text-slate-300 text-lg mb-8">
                {gameState.gameMode === 'classic' ? "Operatives must look away from the screen." : "The other player must look away."}
              </p>
              <div className="text-white/50 text-sm animate-pulse">
                Tap anywhere to view secret matrix
              </div>
            </div>
          </div>
        )}

        {localPhase === 'Operative_Handoff' && !gameState.winner && (
          <div
            className="absolute inset-0 z-40 bg-slate-900/90 backdrop-blur-xl flex items-center justify-center cursor-pointer p-8 text-center"
            onClick={() => setLocalPhase('Operative_Guessing')}
          >
            <div className="max-w-lg glass p-10 rounded-3xl animate-fade-in">
              <h2 className={cn("text-4xl font-black mb-4", 
                gameState.gameMode === 'duet'
                  ? (gameState.currentTurn === 'red' ? "text-green-400" : "text-teal-400")
                  : (gameState.currentTurn === 'red' ? "text-red-500" : "text-blue-500")
              )}>
                CLUE READY
              </h2>
              <p className="text-2xl font-bold mb-8">
                {gameState.gameMode === 'classic' ? `Pass device to ${gameState.currentTurn.toUpperCase()} Operatives` : (gameState.currentTurn === 'red' ? "Pass device to SIDE B" : "Pass device to SIDE A")}
              </p>
              <p className="text-slate-300 text-lg mb-8">
                {gameState.gameMode === 'classic' ? "Spymaster must look away from the screen." : "The other player must look away."}
              </p>
              <div className="text-white/50 text-sm animate-pulse">
                Tap anywhere to reveal cards
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col justify-center pb-8 transition-all duration-1000">
          <Grid
            cards={gameState.cards}
            isSpymaster={gameState.gameMode === 'duet' || isSpymasterVisible || !!gameState.winner}
            disabled={localPhase !== 'Operative_Guessing' || !!gameState.winner}
            onCardClick={handleCardClick}
            gameMode={gameState.gameMode}
            playerTeam={isSpymasterVisible ? gameState.currentTurn : expectedGuessTeam}
            clueTargets={clueTargets}
            isGivingClue={localPhase === 'Spymaster_Input'}
          />
          {localPhase === 'Operative_Guessing' && !gameState.winner && (
            <ActiveClueBar 
              activeCue={gameState.activeCue}
              activeCueNumber={gameState.activeCueNumber}
              successfulGuessesThisTurn={gameState.successfulGuessesThisTurn}
              onEndTurn={handleEndTurn}
              canEndTurn={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}
