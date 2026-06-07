import { Server, Socket } from 'socket.io';
import { GameState, Player, Language, GameMode, TimerSettings, CustomWordWeight } from '../../../shared/types';
import { generateGrid, generateDuetGrid, shuffleArray } from '../../../shared/gameLogic';
import { MODIFIERS, checkRhyme } from '../../../shared/modifiers';

interface Room {
  id: string;
  players: Player[];
  gameState: GameState | null;
  timerInterval?: NodeJS.Timeout;
  settings?: any;
}

const rooms: Record<string, Room> = {};

export function getPublicRooms() {
  return Object.values(rooms).map(r => ({
    roomID: r.id,
    players: r.players.length,
    hostName: r.players.length > 0 ? r.players[0].name : 'Unknown',
    gameStarted: !!r.gameState,
    gameMode: r.gameState?.gameMode || 'classic'
  }));
}

function stopTimer(room: Room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = undefined;
  }
}

function revertActiveModifier(room: Room) {
  const gameState = room.gameState;
  if (!gameState || !gameState.activeModifier) return;

  const modifier = gameState.activeModifier;
  const state = gameState.modifierState;

  if (modifier === 'the-mimic') {
    if (state && state.mimicCardId !== undefined) {
      const card = gameState.cards.find(c => c.id === state.mimicCardId);
      if (card) {
        if (gameState.gameMode === 'duet') {
          if (state.originalType) {
            if (state.guesserTeam === 'blue') {
              card.duetTypeA = state.originalType;
            } else {
              card.duetTypeB = state.originalType;
            }
          }
        } else {
          card.type = 'neutral';
        }
      }
    }
  }

  gameState.activeModifier = null;
  gameState.modifierState = null;
}

function applyRandomModifier(room: Room) {
  const gameState = room.gameState;
  if (!gameState) return;

  const enabled = gameState.enabledModifiers || MODIFIERS.map(m => m.id);
  const availableModifiers = MODIFIERS.filter(m => enabled.includes(m.id));

  if (availableModifiers.length === 0) {
    gameState.activeModifier = null;
    gameState.modifierState = null;
    return;
  }

  const randomModifier = availableModifiers[Math.floor(Math.random() * availableModifiers.length)];
  gameState.activeModifier = randomModifier.id;
  gameState.modifierState = {};

  if (randomModifier.id === 'dimensional-scramble') {
    const unrevealedIndices: number[] = [];
    gameState.cards.forEach((c, idx) => {
      if (!c.revealed) {
        unrevealedIndices.push(idx);
      }
    });

    if (unrevealedIndices.length >= 3) {
      const shuffledIndices = shuffleArray([...unrevealedIndices]);
      const idx1 = shuffledIndices[0];
      const idx2 = shuffledIndices[1];
      const idx3 = shuffledIndices[2];

      gameState.modifierState = {
        originalWords: gameState.cards.map(c => c.word)
      };

      const tempWord = gameState.cards[idx1].word;
      gameState.cards[idx1].word = gameState.cards[idx2].word;
      gameState.cards[idx2].word = gameState.cards[idx3].word;
      gameState.cards[idx3].word = tempWord;
    }
  } else if (randomModifier.id === 'the-mimic') {
    const neutralIndices: number[] = [];
    const isDuet = gameState.gameMode === 'duet';
    const expectedGuessTeam = isDuet ? 
      (gameState.currentTurn === 'red' ? 'blue' : 'red') : 
      gameState.currentTurn;

    gameState.cards.forEach((c, idx) => {
      if (isDuet) {
        const keyType = expectedGuessTeam === 'blue' ? c.duetTypeA : c.duetTypeB;
        const alreadyRevealed = expectedGuessTeam === 'blue' ? c.revealedByB : c.revealedByA;
        if (!alreadyRevealed && keyType === 'neutral') {
          neutralIndices.push(idx);
        }
      } else {
        if (!c.revealed && c.type === 'neutral') {
          neutralIndices.push(idx);
        }
      }
    });

    if (neutralIndices.length > 0) {
      const randomIdx = neutralIndices[Math.floor(Math.random() * neutralIndices.length)];
      const card = gameState.cards[randomIdx];
      if (isDuet) {
        gameState.modifierState = {
          mimicCardId: card.id,
          originalType: 'neutral',
          guesserTeam: expectedGuessTeam
        };
        if (expectedGuessTeam === 'blue') {
          card.duetTypeA = 'assassin';
        } else {
          card.duetTypeB = 'assassin';
        }
      } else {
        gameState.modifierState = {
          mimicCardId: card.id,
          originalType: 'neutral'
        };
        card.type = 'assassin';
      }
    }
  } else if (randomModifier.id === 'blood-pact') {
    gameState.modifierState = {
      bloodPactStatus: 'available'
    };
  } else if (randomModifier.id === 'shield-wall') {
    gameState.modifierState = {
      shieldActive: true
    };
  }
}

function transitionToNewTurn(io: Server, room: Room) {
  const gameState = room.gameState;
  if (!gameState) return;

  revertActiveModifier(room);

  const nextTurn = gameState.gameMode === 'duet'
    ? getNextTurnDuet(gameState)
    : (gameState.currentTurn === 'red' ? 'blue' : 'red');
  
  gameState.currentTurn = nextTurn;
  gameState.currentPhase = 'spymaster';
  gameState.activeCue = null;
  gameState.activeCueNumber = null;
  gameState.successfulGuessesThisTurn = 0;
  gameState.highlightedCards = {};

  gameState.cards.forEach(card => {
    if (card.shieldedTurns && card.shieldedTurns > 0) {
      card.shieldedTurns--;
    }
  });

  if (gameState.gameMode === 'duet') {
    gameState.timerTokens--;
    if (gameState.timerTokens <= 0) {
      gameState.winner = 'spectator';
    }
  }

  if (gameState.chaosMode) {
    applyRandomModifier(room);
  }

  startTimer(io, room);
}

function startTimer(io: Server, room: Room) {
  stopTimer(room);
  if (!room.gameState) return;
  
  const isHaste = room.gameState.activeModifier === 'haste' && room.gameState.currentPhase === 'operative';
  if (room.gameState.timerSettings.preset === 'off' && !isHaste) return;
  
  let duration = 0;
  if (isHaste) {
    duration = 15;
  } else if (room.gameState.currentPhase === 'spymaster') {
    duration = room.gameState.timerSettings.spymasterTime;
    if (room.gameState.isFirstTurnOfGame) {
      duration += room.gameState.timerSettings.extraFirstClueTime;
    }
  } else {
    duration = room.gameState.timerSettings.operativeTime;
  }
  
  room.gameState.timeRemaining = duration;
  io.to(room.id).emit('timer_tick', room.gameState.timeRemaining);
  
  room.timerInterval = setInterval(() => {
    if (!room.gameState || room.gameState.winner) {
      stopTimer(room);
      return;
    }
    
    const isTimerFrozen = room.gameState.activeModifier === 'critical-hit' && room.gameState.modifierState?.timerFrozen;
    
    if (!isTimerFrozen) {
      room.gameState.timeRemaining--;
    }
    io.to(room.id).emit('timer_tick', room.gameState.timeRemaining);
    
    if (room.gameState.timeRemaining <= 0) {
      stopTimer(room);
      
      if (room.gameState.currentPhase === 'spymaster') {
        room.gameState.activeCue = "";
        room.gameState.activeCueNumber = 0;
        room.gameState.currentPhase = 'operative';
        room.gameState.successfulGuessesThisTurn = 0;
        
        room.gameState.gameLog.push({
          id: Math.random().toString(36).substring(7),
          type: 'guess',
          player: { name: 'System', avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=System&backgroundColor=333333` },
          guessingTeam: room.gameState.currentTurn as 'red' | 'blue',
          cardWord: 'Timer Expired',
          revealedColor: 'neutral',
          timestamp: Date.now()
        });
        
        io.to(room.id).emit('game_update', room.gameState);
        startTimer(io, room);
      } else {
        room.gameState.gameLog.push({
          id: Math.random().toString(36).substring(7),
          type: 'guess',
          player: { name: 'System', avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=System&backgroundColor=333333` },
          guessingTeam: room.gameState.currentTurn as 'red' | 'blue',
          cardWord: 'Turn Ended (Timer)',
          revealedColor: 'neutral',
          timestamp: Date.now()
        });
        
        transitionToNewTurn(io, room);
        io.to(room.id).emit('game_update', room.gameState);
      }
    }
  }, 1000);
}

function getSafeRoom(room: Room) {
  const { timerInterval, ...safeRoom } = room;
  return safeRoom;
}

function getNextTurnDuet(gameState: GameState): 'red' | 'blue' {
  let nextTurn: 'red' | 'blue' = gameState.currentTurn === 'red' ? 'blue' : 'red';
  if (nextTurn === 'red') {
    const aRemaining = gameState.cards.filter(c => c.duetTypeA === 'green' && !c.revealedByB).length;
    if (aRemaining === 0) return 'blue';
  } else {
    const bRemaining = gameState.cards.filter(c => c.duetTypeB === 'green' && !c.revealedByA).length;
    if (bRemaining === 0) return 'red';
  }
  return nextTurn;
}

function processGuess(io: Server, room: Room, player: Player, cardId: number) {
  if (!room.gameState || room.gameState.winner) return;
  if (room.gameState.currentPhase !== 'operative') return;

  const isDuet = room.gameState.gameMode === 'duet';
  const expectedGuessTeam = isDuet ? 
    (room.gameState.currentTurn === 'red' ? 'blue' : 'red') : 
    room.gameState.currentTurn;

  if (player.team !== expectedGuessTeam || (!isDuet && player.role !== 'operative')) return;
  
  const maxGuesses = room.gameState.activeCueNumber === 99 ? Infinity : (room.gameState.activeCueNumber || 0) + 1;
  if (room.gameState.successfulGuessesThisTurn >= maxGuesses) return;

  const card = room.gameState.cards.find(c => c.id === cardId);
  if (!card) return;
  
  if (card.shieldedTurns && card.shieldedTurns > 0) return;

  const endTurn = () => {
    transitionToNewTurn(io, room);
  };

  const endTurnDuet = () => {
    transitionToNewTurn(io, room);
  };

  if (isDuet) {
    const alreadyRevealed = expectedGuessTeam === 'blue' ? card.revealedByB : card.revealedByA;
    if (alreadyRevealed) return;
    
    const keyType = expectedGuessTeam === 'blue' ? card.duetTypeA : card.duetTypeB;
    if (expectedGuessTeam === 'blue') card.revealedByB = true;
    else card.revealedByA = true;
    
    if (room.gameState.highlightedCards) {
      for (const playerId of Object.keys(room.gameState.highlightedCards)) {
        room.gameState.highlightedCards[playerId] = room.gameState.highlightedCards[playerId].filter(cId => cId !== cardId);
      }
    }

    if (keyType === 'green' || keyType === 'assassin' || (card.revealedByA && card.revealedByB)) {
      card.revealed = true;
      card.type = keyType!;
    }
    
    room.gameState.gameLog.push({
      id: Math.random().toString(36).substring(7),
      type: 'guess',
      player: { 
        name: player.name, 
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=${player.team === 'red' ? 'ef4444' : '3b82f6'}` 
      },
      guessingTeam: expectedGuessTeam as 'red' | 'blue',
      cardWord: card.word,
      revealedColor: keyType!,
      timestamp: Date.now()
    });

    if (keyType === 'assassin') {
      room.gameState.winner = 'spectator';
    } else if (keyType === 'neutral') {
      endTurnDuet();
    } else if (keyType === 'green') {
      if (room.gameState.activeModifier === 'critical-hit' && room.gameState.successfulGuessesThisTurn === 0 && room.gameState.timerSettings.preset !== 'off') {
        const duration = room.gameState.timerSettings.operativeTime;
        if (room.gameState.timeRemaining >= duration - 5) {
          if (!room.gameState.modifierState) room.gameState.modifierState = {};
          room.gameState.modifierState.timerFrozen = true;
        }
      }

      room.gameState.successfulGuessesThisTurn++;
      
      let foundGreens = 0;
      room.gameState.cards.forEach(c => {
        if (c.duetTypeA === 'green' && c.revealedByB) foundGreens++;
        if (c.duetTypeB === 'green' && c.revealedByA) foundGreens++;
      });
      
      if (foundGreens >= 15) {
        room.gameState.winner = 'red';
      } else {
        let remainingTargetsForCurrentTeam = 0;
        if (expectedGuessTeam === 'blue') {
          remainingTargetsForCurrentTeam = room.gameState.cards.filter(c => c.duetTypeA === 'green' && !c.revealedByB).length;
        } else {
          remainingTargetsForCurrentTeam = room.gameState.cards.filter(c => c.duetTypeB === 'green' && !c.revealedByA).length;
        }

        if (remainingTargetsForCurrentTeam === 0 || room.gameState.successfulGuessesThisTurn >= maxGuesses) {
          endTurnDuet();
        }
      }
    }
  } else {
    if (!card.revealed) {
      card.revealed = true;
      if (room.gameState.highlightedCards) {
        for (const playerId of Object.keys(room.gameState.highlightedCards)) {
          room.gameState.highlightedCards[playerId] = room.gameState.highlightedCards[playerId].filter(cId => cId !== cardId);
        }
      }
      
      room.gameState.gameLog.push({
        id: Math.random().toString(36).substring(7),
        type: 'guess',
        player: { 
          name: player.name, 
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=${player.team === 'red' ? 'ef4444' : '3b82f6'}` 
        },
        guessingTeam: expectedGuessTeam as 'red' | 'blue',
        cardWord: card.word,
        revealedColor: card.type,
        timestamp: Date.now()
      });

      if (card.type === 'assassin') {
        room.gameState.winner = room.gameState.currentTurn === 'red' ? 'blue' : 'red';
      } else if (card.type === 'red') {
        room.gameState.redScore--;
        if (room.gameState.redScore === 0) {
          room.gameState.winner = 'red';
        } else if (room.gameState.currentTurn === 'blue') {
          endTurn(); 
        } else {
          if (room.gameState.activeModifier === 'critical-hit' && room.gameState.successfulGuessesThisTurn === 0 && room.gameState.timerSettings.preset !== 'off') {
            const duration = room.gameState.timerSettings.operativeTime;
            if (room.gameState.timeRemaining >= duration - 5) {
              if (!room.gameState.modifierState) room.gameState.modifierState = {};
              room.gameState.modifierState.timerFrozen = true;
            }
          }

          room.gameState.successfulGuessesThisTurn++;
          if (room.gameState.successfulGuessesThisTurn >= maxGuesses) {
            endTurn();
          } else if (room.gameState.redScore === 0) {
            endTurn();
          }
        }
      } else if (card.type === 'blue') {
        room.gameState.blueScore--;
        if (room.gameState.blueScore === 0) {
          room.gameState.winner = 'blue';
        } else if (room.gameState.currentTurn === 'red') {
          endTurn();
        } else {
          if (room.gameState.activeModifier === 'critical-hit' && room.gameState.successfulGuessesThisTurn === 0 && room.gameState.timerSettings.preset !== 'off') {
            const duration = room.gameState.timerSettings.operativeTime;
            if (room.gameState.timeRemaining >= duration - 5) {
              if (!room.gameState.modifierState) room.gameState.modifierState = {};
              room.gameState.modifierState.timerFrozen = true;
            }
          }

          room.gameState.successfulGuessesThisTurn++;
          if (room.gameState.successfulGuessesThisTurn >= maxGuesses) {
            endTurn();
          } else if (room.gameState.blueScore === 0) {
            endTurn();
          }
        }
      } else if (card.type === 'neutral') {
        endTurn();
      }
    }
  }

  if (room.gameState && !room.gameState.winner && room.gameState.modifierState?.bloodPactOneGuessLeft) {
    if (room.gameState.currentPhase === 'operative') {
      transitionToNewTurn(io, room);
    }
  }

  io.to(room.id).emit('game_update', room.gameState);
}

export function setupRoomManager(io: Server) {

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('join_room_as_observer', (roomId: string) => {
      socket.join(roomId);
      if (!rooms[roomId]) {
        rooms[roomId] = {
          id: roomId,
          players: [],
          gameState: null,
        };
      }
      
      const newPlayer: Player = {
        id: socket.id,
        name: `Spectator ${socket.id.substring(0, 4)}`,
        team: 'spectator',
        role: 'spectator'
      };
      
      const existingPlayerIndex = rooms[roomId].players.findIndex(p => p.id === newPlayer.id);
      if (existingPlayerIndex !== -1) {
        rooms[roomId].players[existingPlayerIndex] = newPlayer;
      } else {
        rooms[roomId].players.push(newPlayer);
      }
      
      socket.emit('room_update', getSafeRoom(rooms[roomId]));
      if (rooms[roomId].settings) {
        socket.emit('settings_updated', rooms[roomId].settings);
      }
      if (rooms[roomId].gameState) {
        socket.emit('game_started', rooms[roomId].gameState);
      }
    });

    socket.on('join_room', ({ roomId, player, explicitChange }: { roomId: string; player: Player; explicitChange?: boolean }) => {
      socket.join(roomId);
      
      if (!rooms[roomId]) {
        rooms[roomId] = {
          id: roomId,
          players: [],
          gameState: null,
        };
      }
      
      const existingPlayerIndex = rooms[roomId].players.findIndex(p => 
        (player.sessionId && p.sessionId === player.sessionId) || p.id === player.id
      );
      
      if (existingPlayerIndex !== -1) {
        const existingPlayer = rooms[roomId].players[existingPlayerIndex];
        
        rooms[roomId].players[existingPlayerIndex] = {
          ...existingPlayer,
          id: player.id,
          name: player.name,
          team: explicitChange ? player.team : existingPlayer.team,
          role: explicitChange ? player.role : existingPlayer.role,
          connected: true
        };
      } else {
        rooms[roomId].players.push({
          ...player,
          connected: true
        });
      }

      io.to(roomId).emit('room_update', getSafeRoom(rooms[roomId]));
      if (rooms[roomId].settings) {
        socket.emit('settings_updated', rooms[roomId].settings);
      }
      if (rooms[roomId].gameState) {
        socket.emit('game_started', rooms[roomId].gameState);
      }
    });

    socket.on('reset_teams', ({ roomId }: { roomId: string }) => {
      const room = rooms[roomId];
      if (room) {
        room.players.forEach(p => {
          p.team = 'spectator';
          p.role = 'spectator';
        });
        io.to(roomId).emit('room_update', getSafeRoom(room));
      }
    });

    socket.on('update_settings', ({ roomId, settings }: { roomId: string, settings: any }) => {
      const room = rooms[roomId];
      if (room) {
        room.settings = settings;
        io.to(roomId).emit('settings_updated', settings);
      }
    });

    socket.on('randomize_teams', ({ roomId }: { roomId: string }) => {
      const room = rooms[roomId];
      if (room) {
        const shuffled = shuffleArray([...room.players]);
        shuffled.forEach((p, i) => {
          if (i === 0) { p.team = 'red'; p.role = 'spymaster'; }
          else if (i === 1) { p.team = 'blue'; p.role = 'spymaster'; }
          else if (i % 2 === 0) { p.team = 'red'; p.role = 'operative'; }
          else { p.team = 'blue'; p.role = 'operative'; }
        });
        
        room.players.forEach(rp => {
          const matched = shuffled.find(sp => sp.id === rp.id);
          if (matched) {
            rp.team = matched.team;
            rp.role = matched.role;
          }
        });
        io.to(roomId).emit('room_update', getSafeRoom(room));
      }
    });

    socket.on('start_game', ({ roomId, language, gameMode, timerSettings, selectedPacks, customWords, customWordWeight, clueType, chaosMode, enabledModifiers }: { roomId: string, language: Language, gameMode: GameMode, timerSettings: TimerSettings, selectedPacks: string[], customWords: string[], customWordWeight: CustomWordWeight, clueType: any, chaosMode?: boolean, enabledModifiers?: string[] }) => {
      const room = rooms[roomId];
      if (room) {
        const { cards, startingTeam } = gameMode === 'duet' 
          ? generateDuetGrid(language, selectedPacks, customWords, customWordWeight) 
          : generateGrid(language, selectedPacks, customWords, customWordWeight);
        
        let initialTimeRemaining = 0;
        if (timerSettings.preset !== 'off') {
          initialTimeRemaining = timerSettings.spymasterTime + timerSettings.extraFirstClueTime;
        }

        room.gameState = {
          gameMode,
          timerSettings,
          isFirstTurnOfGame: true,
          timeRemaining: initialTimeRemaining,
          timerTokens: gameMode === 'duet' ? 9 : 0,
          isRTL: language === 'ar',
          cards,
          currentTurn: startingTeam,
          currentPhase: 'spymaster',
          activeCue: null,
          activeCueNumber: null,
          successfulGuessesThisTurn: 0,
          winner: null,
          redScore: startingTeam === 'red' ? 9 : 8,
          blueScore: startingTeam === 'blue' ? 9 : 8,
          language,
          gameLog: [],
          highlightedCards: {},
          clueType,
          chaosMode: !!chaosMode,
          enabledModifiers: enabledModifiers || MODIFIERS.map(m => m.id)
        };

        if (chaosMode) {
          applyRandomModifier(room);
        }

        startTimer(io, room);

        io.to(roomId).emit('game_started', room.gameState);
        io.to(roomId).emit('room_update', getSafeRoom(room));
      }
    });

    socket.on('submit_cue', ({ roomId, cue, number, targets }: { roomId: string, cue: string, number: number, targets?: number[] }) => {
      const room = rooms[roomId];
      const player = room?.players.find(p => p.id === socket.id);
      
      console.log('SUBMIT CUE EVENT:', { roomId, cue, number, targets, activeModifier: room?.gameState?.activeModifier });
      
      if (room && room.gameState && !room.gameState.winner && player) {
        const isDuet = room.gameState.gameMode === 'duet';
        
        if (room.gameState.currentPhase === 'spymaster' && 
            player.team === room.gameState.currentTurn && 
            (player.role === 'spymaster' || isDuet)) {
          
          let finalCue = cue;
          if (room.gameState.activeModifier === 'vowel-void') {
            finalCue = cue.replace(/[aeAE]/g, '');
            if (!finalCue) finalCue = '?';
          } else if (room.gameState.activeModifier === 'oracle-riddle') {
            const words = cue.trim().split(/\s+/).filter(Boolean);
            if (words.length !== 2 || !checkRhyme(words[0], words[1], !!room.gameState.isRTL)) {
              return; // Reject invalid clue
            }
            finalCue = words.join(' ');
          }

          let finalNumber = number;
          if (room.gameState.activeModifier === 'off-by-one') {
            if (number === 99) {
              finalNumber = 99;
            } else if (number === 0) {
              finalNumber = 1;
            } else {
              const change = Math.random() < 0.5 ? -1 : 1;
              finalNumber = number + change;
            }
          }

          room.gameState.activeCue = finalCue;
          room.gameState.activeCueNumber = finalNumber;
          room.gameState.currentPhase = 'operative';
          room.gameState.successfulGuessesThisTurn = 0;
          room.gameState.isFirstTurnOfGame = false;
          room.gameState.highlightedCards = {};
          
          room.gameState.gameLog.push({
            id: Math.random().toString(36).substring(7),
            type: 'cue',
            player: { 
              name: player.name, 
              avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=${player.team === 'red' ? 'ef4444' : '3b82f6'}` 
            },
            team: player.team as 'red' | 'blue',
            cueWord: finalCue,
            cueNumber: finalNumber,
            targets: targets,
            timestamp: Date.now()
          });
          
          startTimer(io, room);
          io.to(roomId).emit('game_update', room.gameState);
        }
      }
    });

    socket.on('highlight_card', ({ roomId, cardId }: { roomId: string, cardId: number | null }) => {
      const room = rooms[roomId];
      const player = room?.players.find(p => p.id === socket.id);
      
      if (room && room.gameState && !room.gameState.winner && player) {
        if (room.gameState.currentPhase !== 'operative') return;
        
        if (!room.gameState.highlightedCards) {
          room.gameState.highlightedCards = {};
        }
        
        if (cardId === null) {
          room.gameState.highlightedCards[player.id] = [];
        } else {
          if (!room.gameState.highlightedCards[player.id]) {
            room.gameState.highlightedCards[player.id] = [];
          }
          const arr = room.gameState.highlightedCards[player.id];
          const idx = arr.indexOf(cardId);
          if (idx !== -1) {
            arr.splice(idx, 1);
          } else {
            arr.push(cardId);
          }
        }
        io.to(roomId).emit('game_update', room.gameState);
      }
    });

    socket.on('guess_card', ({ roomId, cardId }: { roomId: string, cardId: number }) => {
      const room = rooms[roomId];
      const player = room?.players.find(p => p.id === socket.id);
      if (room && player) {
        processGuess(io, room, player, cardId);
      }
    });
    
    socket.on('end_turn', ({ roomId }: { roomId: string }) => {
      const room = rooms[roomId];
      const player = room?.players.find(p => p.id === socket.id);
      
      if (room && room.gameState && !room.gameState.winner && player) {
        const isDuet = room.gameState.gameMode === 'duet';
        const expectedGuessTeam = isDuet ? 
          (room.gameState.currentTurn === 'red' ? 'blue' : 'red') : 
          room.gameState.currentTurn;

        if (room.gameState.currentPhase === 'operative' && player.team === expectedGuessTeam && (player.role === 'operative' || isDuet)) {
          room.gameState.gameLog.push({
            id: Math.random().toString(36).substring(7),
            type: 'guess',
            player: { 
              name: player.name, 
              avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=${player.team === 'red' ? 'ef4444' : '3b82f6'}` 
            },
            guessingTeam: player.team as 'red' | 'blue',
            cardWord: 'Ended Turn',
            revealedColor: 'neutral',
            timestamp: Date.now()
          });
          
          transitionToNewTurn(io, room);
          io.to(roomId).emit('game_update', room.gameState);
        }
      }
    });

    socket.on('use_blood_pact', ({ roomId, cardId }: { roomId: string, cardId: number }) => {
      const room = rooms[roomId];
      const player = room?.players.find(p => p.id === socket.id);
      
      if (room && room.gameState && !room.gameState.winner && player) {
        if (room.gameState.currentPhase !== 'operative') return;
        if (room.gameState.activeModifier !== 'blood-pact') return;
        if (room.gameState.modifierState?.bloodPactStatus !== 'available') return;
        if (room.gameState.successfulGuessesThisTurn > 0) return;
        
        const isDuet = room.gameState.gameMode === 'duet';
        const expectedGuessTeam = isDuet ? 
          (room.gameState.currentTurn === 'red' ? 'blue' : 'red') : 
          room.gameState.currentTurn;
          
        if (player.team !== expectedGuessTeam || (!isDuet && player.role !== 'operative')) return;
        
        const card = room.gameState.cards.find(c => c.id === cardId);
        if (!card) return;
        
        if (isDuet) {
          const alreadyRevealed = expectedGuessTeam === 'blue' ? card.revealedByB : card.revealedByA;
          if (alreadyRevealed) return;
          
          if (expectedGuessTeam === 'blue') card.revealedByB = true;
          else card.revealedByA = true;
          
          const keyType = expectedGuessTeam === 'blue' ? card.duetTypeA : card.duetTypeB;
          
          if (keyType === 'green' || keyType === 'assassin' || (card.revealedByA && card.revealedByB)) {
            card.revealed = true;
            card.type = keyType!;
          }
          
          room.gameState.gameLog.push({
            id: Math.random().toString(36).substring(7),
            type: 'guess',
            player: { 
              name: `${player.name} (Blood Pact)`, 
              avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=882222` 
            },
            guessingTeam: expectedGuessTeam as 'red' | 'blue',
            cardWord: card.word,
            revealedColor: keyType!,
            timestamp: Date.now()
          });
        } else {
          if (card.revealed) return;
          card.revealed = true;
          
          room.gameState.gameLog.push({
            id: Math.random().toString(36).substring(7),
            type: 'guess',
            player: { 
              name: `${player.name} (Blood Pact)`, 
              avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=882222` 
            },
            guessingTeam: expectedGuessTeam as 'red' | 'blue',
            cardWord: card.word,
            revealedColor: card.type,
            timestamp: Date.now()
          });
        }
        
        if (!isDuet) {
          if (card.type === 'red') {
            room.gameState.redScore--;
            if (room.gameState.redScore === 0) room.gameState.winner = 'red';
          } else if (card.type === 'blue') {
            room.gameState.blueScore--;
            if (room.gameState.blueScore === 0) room.gameState.winner = 'blue';
          }
        } else {
          let foundGreens = 0;
          room.gameState.cards.forEach(c => {
            if (c.duetTypeA === 'green' && c.revealedByB) foundGreens++;
            if (c.duetTypeB === 'green' && c.revealedByA) foundGreens++;
          });
          if (foundGreens >= 15) {
            room.gameState.winner = 'red';
          }
        }
        
        if (room.gameState.highlightedCards) {
          for (const playerId of Object.keys(room.gameState.highlightedCards)) {
            room.gameState.highlightedCards[playerId] = room.gameState.highlightedCards[playerId].filter(cId => cId !== cardId);
          }
        }
        
        room.gameState.modifierState.bloodPactStatus = 'used';
        room.gameState.modifierState.bloodPactOneGuessLeft = true;
        
        io.to(roomId).emit('game_update', room.gameState);
      }
    });

    socket.on('gacha_pull', ({ roomId }: { roomId: string }) => {
      const room = rooms[roomId];
      const player = room?.players.find(p => p.id === socket.id);
      
      if (room && room.gameState && !room.gameState.winner && player) {
        if (room.gameState.currentPhase !== 'operative') return;
        if (room.gameState.activeModifier !== 'gacha-pull') return;
        if (room.gameState.modifierState?.gachaPulling) return;
        
        const isDuet = room.gameState.gameMode === 'duet';
        const expectedGuessTeam = isDuet ? 
          (room.gameState.currentTurn === 'red' ? 'blue' : 'red') : 
          room.gameState.currentTurn;
          
        if (player.team !== expectedGuessTeam || (!isDuet && player.role !== 'operative')) return;
        
        const unrevealedCards = room.gameState.cards.filter(c => {
          if (isDuet) {
            return expectedGuessTeam === 'blue' ? !c.revealedByB : !c.revealedByA;
          } else {
            return !c.revealed;
          }
        });
        
        if (unrevealedCards.length > 0) {
          // Set pulling state to lock UI
          if (!room.gameState.modifierState) room.gameState.modifierState = {};
          room.gameState.modifierState.gachaPulling = true;
          io.to(roomId).emit('game_update', room.gameState);

          const randomCard = unrevealedCards[Math.floor(Math.random() * unrevealedCards.length)];
          const candidateIds = unrevealedCards.map(c => c.id);
          
          // Build a pre-computed random highlight sequence so all clients show the exact same random picks
          const highlightSequence: number[] = [];
          const steps = 20;
          for (let i = 0; i < steps; i++) {
            highlightSequence.push(candidateIds[Math.floor(Math.random() * candidateIds.length)]);
          }
          
          // Emit the animation start to all clients
          io.to(roomId).emit('gacha_start_animation', { highlightSequence, targetCardId: randomCard.id });

          setTimeout(() => {
            const currentRoom = rooms[roomId];
            if (currentRoom && currentRoom.gameState) {
              if (currentRoom.gameState.modifierState) {
                delete currentRoom.gameState.modifierState.gachaPulling;
              }
              
              if (!currentRoom.gameState.winner) {
                // Verify card is still unrevealed
                const stillUnrevealed = isDuet ? 
                  (expectedGuessTeam === 'blue' ? !randomCard.revealedByB : !randomCard.revealedByA) :
                  !randomCard.revealed;
                  
                if (stillUnrevealed) {
                  currentRoom.gameState.gameLog.push({
                    id: Math.random().toString(36).substring(7),
                    type: 'guess',
                    player: { 
                      name: `${player.name} (Lever Pull)`, 
                      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=e67e22` 
                    },
                    guessingTeam: expectedGuessTeam as 'red' | 'blue',
                    cardWord: 'Pulled the Gacha Lever!',
                    revealedColor: 'neutral',
                    timestamp: Date.now()
                  });
                  
                  processGuess(io, currentRoom, player, randomCard.id);
                } else {
                  // Fallback emit if card was somehow revealed
                  io.to(roomId).emit('game_update', currentRoom.gameState);
                }
              }
            }
          }, 3800);
        }
      }
    });

    socket.on('lock_card', ({ roomId, cardId }: { roomId: string, cardId: number }) => {
      const room = rooms[roomId];
      const player = room?.players.find(p => p.id === socket.id);
      
      if (room && room.gameState && !room.gameState.winner && player) {
        if (room.gameState.currentPhase !== 'operative') return;
        if (room.gameState.activeModifier !== 'shield-wall') return;
        if (!room.gameState.modifierState?.shieldActive) return;
        
        const isDuet = room.gameState.gameMode === 'duet';
        const expectedGuessTeam = isDuet ? 
          (room.gameState.currentTurn === 'red' ? 'blue' : 'red') : 
          room.gameState.currentTurn;
          
        if (player.team !== expectedGuessTeam || (!isDuet && player.role !== 'operative')) return;
        
        const card = room.gameState.cards.find(c => c.id === cardId);
        if (card) {
          card.shieldedTurns = 2;
          
          room.gameState.gameLog.push({
            id: Math.random().toString(36).substring(7),
            type: 'guess',
            player: { 
              name: player.name, 
              avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=64748b` 
            },
            guessingTeam: expectedGuessTeam as 'red' | 'blue',
            cardWord: `Locked card: ${card.word}`,
            revealedColor: 'neutral',
            timestamp: Date.now()
          });
          
          room.gameState.modifierState.shieldActive = false;
          
          io.to(roomId).emit('game_update', room.gameState);
        }
      }
    });

    socket.on('prank_vibrate', ({ roomId, targetPlayerId }: { roomId: string, targetPlayerId: string }) => {
      const room = rooms[roomId];
      if (room && room.players.length > 0 && room.players[0].id === socket.id) {
        io.to(roomId).emit('trigger_prank', { targetPlayerId });
      }
    });

    socket.on('play_again', ({ roomId }: { roomId: string }) => {
      const room = rooms[roomId];
      if (room && room.players.length > 0 && room.players[0].id === socket.id) {
        room.gameState = null;
        io.to(roomId).emit('return_to_lobby');
        io.to(roomId).emit('room_update', getSafeRoom(room));
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      for (const roomId in rooms) {
        const room = rooms[roomId];
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          if (playerIndex === 0) {
            io.to(roomId).emit('host_disconnected');
            delete rooms[roomId];
          } else {
            room.players[playerIndex].connected = false;
            io.to(roomId).emit('room_update', getSafeRoom(room));
          }
        }
      }
    });
  });
}
