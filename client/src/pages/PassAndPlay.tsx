import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useGameContext } from "../context/GameContext";
import { useI18n } from "../context/I18nContext";
import { generateGrid, generateDuetGrid } from "../../../shared/gameLogic";
import type { GameState, CustomWordWeight, TimerSettings, Team, ClueType } from "../../../shared/types";
import { MODIFIERS } from "../../../shared/modifiers";
import Grid from "../components/Grid";
import TopBar from "../components/TopBar";
import ActiveClueBar from "../components/ActiveClueBar";
import GiveClueBar from "../components/GiveClueBar";
import GameLog from '../components/GameLog';
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
  const { t } = useI18n();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [localPhase, setLocalPhase] = useState<LocalPhase>('Setup');
  const [clueTargets, setClueTargets] = useState<number[]>([]);

  // Setup State
  const [gameMode, setGameMode] = useState<'classic'|'duet'>(() => (localStorage.getItem('host_gameMode') as 'classic'|'duet') || 'classic');
  const [selectedPacks, setSelectedPacks] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('host_selectedPacks') || '["classic"]'); } catch { return ['classic']; }
  });
  const [clueType, setClueType] = useState<ClueType>(() => (localStorage.getItem('host_clueType') as ClueType) || 'text');
  const [customWordsText, setCustomWordsText] = useState(() => localStorage.getItem('host_customWordsText') || '');
  const [customWordWeight, setCustomWordWeight] = useState<CustomWordWeight>(() => (localStorage.getItem('host_customWordWeight') as CustomWordWeight) || 'none');
  const [timerSettings, setTimerSettings] = useState<TimerSettings>(() => {
    try { return JSON.parse(localStorage.getItem('host_timerSettings') || '{"preset":"off","spymasterTime":0,"operativeTime":0,"extraFirstClueTime":0}'); } 
    catch { return { preset: 'off', spymasterTime: 0, operativeTime: 0, extraFirstClueTime: 0 }; }
  });
  const [chaosMode, setChaosMode] = useState<boolean>(() => localStorage.getItem('host_chaosMode') === 'true');
  const [enabledModifiers, setEnabledModifiers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('host_enabledModifiers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return MODIFIERS.map(m => m.id);
  });

  useEffect(() => {
    localStorage.setItem('host_gameMode', gameMode);
    localStorage.setItem('host_selectedPacks', JSON.stringify(selectedPacks));
    localStorage.setItem('host_clueType', clueType);
    localStorage.setItem('host_customWordsText', customWordsText);
    localStorage.setItem('host_customWordWeight', customWordWeight);
    localStorage.setItem('host_timerSettings', JSON.stringify(timerSettings));
    localStorage.setItem('host_chaosMode', String(chaosMode));
    localStorage.setItem('host_enabledModifiers', JSON.stringify(enabledModifiers));
  }, [gameMode, selectedPacks, clueType, customWordsText, customWordWeight, timerSettings, chaosMode, enabledModifiers]);

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
        if (newTime <= 10 && newTime > 0) {
          import("../utils/haptics").then(({ triggerHeartbeatVibration }) => triggerHeartbeatVibration(newTime));
        }

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
              highlightedCards: {},
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
              highlightedCards: {},
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
    if (gameState && !gameState.winner && localPhase !== 'Spymaster_Setup' && localPhase !== 'Operative_Handoff') {
      startTimer(gameState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localPhase, gameState?.currentPhase]);

  const previousWinner = useRef<string | null>(null);
  useEffect(() => {
    if (gameState?.winner && gameState.winner !== previousWinner.current) {
      import("../utils/haptics").then(({ triggerPrankVibration }) => {
        triggerPrankVibration();
      });
    }
    previousWinner.current = gameState?.winner || null;
  }, [gameState?.winner]);

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
      highlightedCards: {},
      clueType,
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

    const maxGuesses = gameState.activeCueNumber === 99 ? Infinity : (gameState.activeCueNumber || 0) + 1;
    if (gameState.successfulGuessesThisTurn >= maxGuesses) return;

    const playerKey = 'local_players';
    setGameState(prev => {
      if (!prev) return null;
      const newHighlights = prev.highlightedCards ? { ...prev.highlightedCards } : {};
      if (!newHighlights[playerKey]) newHighlights[playerKey] = [];
      const arr = newHighlights[playerKey];
      const idx = arr.indexOf(id);
      if (idx !== -1) {
        newHighlights[playerKey] = arr.filter(cId => cId !== id);
      } else {
        newHighlights[playerKey] = [...arr, id];
      }
      return { ...prev, highlightedCards: newHighlights };
    });
  };

  const handleGuessCard = (id: number) => {
    if (!gameState || gameState.winner) return;
    if (localPhase !== "Operative_Guessing") return;

    const maxGuesses = gameState.activeCueNumber === 99 ? Infinity : (gameState.activeCueNumber || 0) + 1;
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
      
      if (keyType === 'green' || keyType === 'assassin' || (card.revealedByA && card.revealedByB)) {
        card.revealed = true;
        card.type = keyType!; 
        playCardRevealSfx(keyType as any);
      } else {
        playCardRevealSfx('neutral'); // still play sound for neutral token drop
      }

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

    setGameState(prev => {
      if (!prev) return null;
      // On turn end, clear all highlights; otherwise remove only the guessed card
      let updatedHighlights = prev.highlightedCards ? { ...prev.highlightedCards } : {};
      if (newPhase === 'Spymaster_Setup') {
        updatedHighlights = {};
      } else {
        for (const playerId of Object.keys(updatedHighlights)) {
          updatedHighlights[playerId] = updatedHighlights[playerId].filter(cId => cId !== id);
        }
      }
      return {
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
        currentPhase: newPhase === 'Spymaster_Setup' ? 'spymaster' : 'operative',
        highlightedCards: updatedHighlights,
        gameLog: [...(prev.gameLog || []), {
          id: Math.random().toString(36).substring(7),
          type: 'guess',
          player: {
            name: prev.gameMode === 'duet' ? (prev.currentTurn === 'red' ? 'SIDE B' : 'SIDE A') : `${prev.currentTurn.toUpperCase()} OPERATIVES`,
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent('Operatives')}&backgroundColor=${prev.currentTurn === 'red' ? 'ef4444' : '3b82f6'}`
          },
          guessingTeam: (prev.gameMode === 'duet' ? (prev.currentTurn === 'red' ? 'blue' : 'red') : prev.currentTurn) as 'red' | 'blue',
          cardWord: card.word,
          revealedColor: card.type,
          timestamp: Date.now()
        }]
      };
    });
    
    setLocalPhase(newPhase);
  };

  const handleCardContextMenu = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    if (!gameState || gameState.winner || localPhase !== "Operative_Guessing") return;
    
    const playerKey = 'local_players';
    setGameState(prev => {
      if (!prev) return null;
      const newHighlights = prev.highlightedCards ? { ...prev.highlightedCards } : {};
      if (!newHighlights[playerKey]) newHighlights[playerKey] = [];
      const arr = newHighlights[playerKey];
      const idx = arr.indexOf(id);
      if (idx !== -1) {
        newHighlights[playerKey] = arr.filter(cId => cId !== id);
      } else {
        newHighlights[playerKey] = [...arr, id];
      }
      return { ...prev, highlightedCards: newHighlights };
    });
  };

  const handleSubmitCue = (cue: string, number: number) => {
    if (!gameState || localPhase !== 'Spymaster_Input') return;
    setGameState(prev => prev ? ({
      ...prev,
      activeCue: cue,
      activeCueNumber: number,
      successfulGuessesThisTurn: 0,
      currentPhase: 'operative',
      gameLog: [...(prev.gameLog || []), {
        id: Math.random().toString(36).substring(7),
        type: 'cue',
        player: { 
          name: prev.gameMode === 'duet' ? (prev.currentTurn === 'red' ? 'SIDE A' : 'SIDE B') : `${prev.currentTurn.toUpperCase()} SPYMASTER`,
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent('Spymaster')}&backgroundColor=${prev.currentTurn === 'red' ? 'ef4444' : '3b82f6'}`
        },
        team: prev.currentTurn as 'red' | 'blue',
        cueWord: cue,
        cueNumber: number,
        timestamp: Date.now()
      }]
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
          <h1 className="mx-4 text-xl font-black tracking-widest text-slate-200">{t('pass_play_setup')}</h1>
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
              clueType={clueType}
              setClueType={setClueType}
              chaosMode={chaosMode}
              setChaosMode={setChaosMode}
              enabledModifiers={enabledModifiers}
              setEnabledModifiers={setEnabledModifiers}
            />
          </div>
          
          <div className="mt-6">
            <button 
              onMouseEnter={playMenuHoverSfx}
              onClick={() => { playMenuClickSfx(); handleStartGame(); }}
              className="w-full py-4 bg-[#22c55e] hover:bg-[#16a34a] rounded-full font-black text-2xl tracking-widest text-white shadow-[0_10px_0_#15803d] hover:translate-y-1 hover:shadow-[0_5px_0_#15803d] transition-all"
            >
              {t('start_game')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) return <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center">{t('loading')}</div>;

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
    <div className={cn(`min-h-screen lg:h-screen lg:max-h-screen ${bgClass} transition-colors duration-1000 flex flex-col relative overflow-hidden lg:overflow-hidden`)}>
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
        clueType={gameState.clueType}
        isRTL={gameState.language === 'ar'}
      />

      <div className="flex-1 flex flex-col items-center p-2 sm:p-4 sm:pt-6 lg:min-h-0 lg:overflow-hidden">
        {gameState.winner && (
          <div className="mb-8 p-6 glass rounded-2xl text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] z-20 animate-fade-in-up">
            {gameState.gameMode === 'duet' ? (
              <h2 className={`text-4xl font-black mb-4 ${gameState.winner === 'red' ? "text-green-500" : "text-red-500"}`}>
                {gameState.winner === 'red' ? t('you_win_together') : t('you_lose_together')}
              </h2>
            ) : (
              <h2 className={`text-4xl font-black mb-4 ${gameState.winner === "red" ? "text-red-500" : "text-blue-500"}`}>
                {gameState.winner === "red" ? t('red_team') : t('blue_team')} {t('team_wins')}
              </h2>
            )}
            <button
              onClick={() => { setGameState(null); setLocalPhase('Setup'); }}
              className="px-8 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              {t('play_again')}
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
                {gameState.gameMode === 'classic' ? `${gameState.currentTurn === "red" ? t('red_team') : t('blue_team')} - ${t('spymaster')}` : (gameState.currentTurn === 'red' ? `${t('side_a')} ${t('gives_clue')}` : `${t('side_b')} ${t('gives_clue')}`)}
              </h2>
              <p className="text-2xl font-bold mb-8">{t('grab_device')}</p>
              <p className="text-slate-300 text-lg mb-8">
                {gameState.gameMode === 'classic' ? t('operatives_look_away') : t('other_player_look_away')}
              </p>
              <div className="text-white/50 text-sm animate-pulse">
                {t('tap_to_view_matrix')}
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
                {t('clue_ready')}
              </h2>
              <p className="text-2xl font-bold mb-8 flex items-center justify-center gap-2" dir="ltr">
                {gameState.gameMode === 'classic' ? `${t('pass_device_to')} ${gameState.currentTurn === "red" ? t('red_team') : t('blue_team')} ${t('operatives')}` : (gameState.currentTurn === 'red' ? `${t('pass_device_to')} ${t('side_b')}` : `${t('pass_device_to')} ${t('side_a')}`)}
              </p>
              <p className="text-slate-300 text-lg mb-8">
                {gameState.gameMode === 'classic' ? t('spymaster_look_away') : t('other_player_look_away')}
              </p>
              <div className="text-white/50 text-sm animate-pulse">
                {t('tap_to_reveal')}
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-[1600px] mx-auto flex-1 flex flex-col lg:flex-row gap-6 justify-center pb-4 lg:pb-0 transition-all duration-1000 lg:min-h-0">
          <div className="flex-1 flex flex-col justify-center lg:min-h-0 lg:overflow-y-auto custom-scrollbar">
            <Grid
              cards={gameState.cards}
              isSpymaster={gameState.gameMode === 'duet' || isSpymasterVisible || !!gameState.winner}
              disabled={localPhase !== 'Operative_Guessing' || !!gameState.winner}
              onCardClick={handleCardClick}
              gameMode={gameState.gameMode}
              playerTeam={isSpymasterVisible ? gameState.currentTurn : expectedGuessTeam}
              clueTargets={clueTargets}
              isGivingClue={localPhase === 'Spymaster_Input'}
              highlightedCards={gameState.highlightedCards || {}}
              players={[{id: 'local_players', name: 'Operatives', role: 'operative', team: expectedGuessTeam}]}
              currentPlayerId="local_players"
              onCardContextMenu={handleCardContextMenu}
              onGuess={handleGuessCard}
              activeModifier={gameState.activeModifier}
              eatenCardIds={
                gameState.activeModifier === 'nimnims-bite'
                  ? gameState.modifierState?.eatenCardIds
                  : undefined
              }
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

            {localPhase === 'Spymaster_Input' && !gameState.winner && (
              <GiveClueBar 
                onSubmitCue={handleSubmitCue}
                clueType={gameState.clueType}
                activeModifier={gameState.activeModifier}
                clueTargetCount={clueTargets.length}
                isRTL={gameState.language === 'ar'}
                modifierState={gameState.modifierState}
              />
            )}
            
            {/* MOBILE GAME LOG */}
            <div className="flex lg:hidden flex-col w-full max-w-lg mx-auto mt-6 h-36 shrink-0">
              <GameLog logs={gameState.gameLog || []} gameMode={gameState.gameMode} />
            </div>
          </div>
          
          {/* DESKTOP GAME LOG */}
          <div className="hidden lg:flex flex-col w-64 xl:w-80 flex-shrink-0 lg:min-h-0 lg:max-h-full lg:overflow-y-auto scrollbar-none">
             <GameLog logs={gameState.gameLog || []} gameMode={gameState.gameMode} />
          </div>
        </div>
      </div>
    </div>
  );
}
