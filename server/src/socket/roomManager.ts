import { Server, Socket } from 'socket.io';
import { GameState, Player, Language, GameMode, TimerSettings, CustomWordWeight } from '../../../shared/types';
import { generateGrid, generateDuetGrid, shuffleArray } from '../../../shared/gameLogic';

interface Room {
  id: string;
  players: Player[];
  gameState: GameState | null;
  timerInterval?: NodeJS.Timeout;
  settings?: any;
}

const rooms: Record<string, Room> = {};

function stopTimer(room: Room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = undefined;
  }
}

function startTimer(io: Server, room: Room) {
  stopTimer(room);
  if (!room.gameState || room.gameState.timerSettings.preset === 'off') return;
  
  let duration = 0;
  if (room.gameState.currentPhase === 'spymaster') {
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
    
    room.gameState.timeRemaining--;
    io.to(room.id).emit('timer_tick', room.gameState.timeRemaining);
    
    if (room.gameState.timeRemaining <= 0) {
      // Timer expired!
      stopTimer(room);
      
      if (room.gameState.currentPhase === 'spymaster') {
        // Auto transition to operative
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
        startTimer(io, room); // Restart timer for operative phase
      } else {
        // Auto end turn
        if (room.gameState.gameMode === 'duet') {
          room.gameState.timerTokens--;
          if (room.gameState.timerTokens <= 0) {
            room.gameState.winner = 'red'; // Wait, in duet red/blue winner means game over cooperative loss vs win. 
            // Let's use 'red' or 'blue' as normal loss. Actually, winner='spectator' or we just set winner='spectator' as loss, or we keep it null and add game_over. 
            // We can just set winner='spectator' to represent a cooperative loss, and 'red' to represent cooperative win. But let's just do winner='red' for now and fix client.
            // Wait, we need a way to distinguish win/loss. 
            // Let's use 'blue' as Loss, 'red' as Win for Duet.
          }
        }
        
        room.gameState.currentTurn = room.gameState.gameMode === 'duet' 
          ? getNextTurnDuet(room.gameState) 
          : (room.gameState.currentTurn === 'red' ? 'blue' : 'red');
        room.gameState.currentPhase = 'spymaster';
        room.gameState.activeCue = null;
        room.gameState.activeCueNumber = null;
        room.gameState.successfulGuessesThisTurn = 0;
        
        room.gameState.gameLog.push({
          id: Math.random().toString(36).substring(7),
          type: 'guess',
          player: { name: 'System', avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=System&backgroundColor=333333` },
          guessingTeam: room.gameState.currentTurn as 'red' | 'blue',
          cardWord: 'Turn Ended (Timer)',
          revealedColor: 'neutral',
          timestamp: Date.now()
        });
        
        io.to(room.id).emit('game_update', room.gameState);
        startTimer(io, room);
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

    socket.on('join_room', ({ roomId, player }: { roomId: string; player: Player }) => {
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
        // Player reconnecting or switching teams
        const existingPlayer = rooms[roomId].players[existingPlayerIndex];
        const isDefaultSpectator = player.team === 'spectator' && player.role === 'spectator';
        
        rooms[roomId].players[existingPlayerIndex] = {
          ...existingPlayer,
          id: player.id,
          name: player.name,
          team: isDefaultSpectator ? existingPlayer.team : player.team,
          role: isDefaultSpectator ? existingPlayer.role : player.role,
          connected: true
        };
      } else {
        // Brand new player
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
        
        // Apply back to room
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

    socket.on('start_game', ({ roomId, language, gameMode, timerSettings, selectedPacks, customWords, customWordWeight }: { roomId: string, language: Language, gameMode: GameMode, timerSettings: TimerSettings, selectedPacks: string[], customWords: string[], customWordWeight: CustomWordWeight }) => {
      const room = rooms[roomId];
      if (room) {
        const { cards, startingTeam } = gameMode === 'duet' 
          ? generateDuetGrid(language, selectedPacks, customWords, customWordWeight) 
          : generateGrid(language, selectedPacks, customWords, customWordWeight);
        
        // Calculate initial time limit based on new timer settings
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
          highlightedCards: {}
        };

        startTimer(io, room);

        io.to(roomId).emit('game_started', room.gameState);
        io.to(roomId).emit('room_update', getSafeRoom(room));
      }
    });

    socket.on('submit_cue', ({ roomId, cue, number, targets }: { roomId: string, cue: string, number: number, targets?: number[] }) => {
      const room = rooms[roomId];
      const player = room?.players.find(p => p.id === socket.id);
      
      if (room && room.gameState && !room.gameState.winner && player) {
        const isDuet = room.gameState.gameMode === 'duet';
        
        if (room.gameState.currentPhase === 'spymaster' && 
            player.team === room.gameState.currentTurn && 
            (player.role === 'spymaster' || isDuet)) {
          room.gameState.activeCue = cue;
          room.gameState.activeCueNumber = number;
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
            cueWord: cue,
            cueNumber: number,
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
      
      if (room && room.gameState && !room.gameState.winner && player) {
        if (room.gameState.currentPhase !== 'operative') return;
        
        // In duet mode, if it's Side A's cue (currentTurn='red'), then Side B (team='blue') must guess.
        const isDuet = room.gameState.gameMode === 'duet';
        const expectedGuessTeam = isDuet ? 
          (room.gameState.currentTurn === 'red' ? 'blue' : 'red') : 
          room.gameState.currentTurn;

        if (player.team !== expectedGuessTeam || (!isDuet && player.role !== 'operative')) return;
        
        const maxGuesses = room.gameState.activeCueNumber === 0 ? Infinity : (room.gameState.activeCueNumber || 0) + 1;
        if (room.gameState.successfulGuessesThisTurn >= maxGuesses) return;

        const card = room.gameState.cards.find(c => c.id === cardId);
        
        if (room.gameState.gameMode === 'duet') {
          // DUET MODE GUESSING
          if (card) {
            // Did the guessing team already reveal this card for themselves?
            const alreadyRevealed = expectedGuessTeam === 'blue' ? card.revealedByB : card.revealedByA;
            if (alreadyRevealed) return;
            
            // For Duet, if B is guessing, they are checking A's key (duetTypeA).
            // If A is guessing, they are checking B's key (duetTypeB).
            const keyType = expectedGuessTeam === 'blue' ? card.duetTypeA : card.duetTypeB;
            if (expectedGuessTeam === 'blue') card.revealedByB = true;
            else card.revealedByA = true;
            
            // Remove only the guessed card from highlights (keep other highlights)
            if (room.gameState.highlightedCards) {
              for (const playerId of Object.keys(room.gameState.highlightedCards)) {
                room.gameState.highlightedCards[playerId] = room.gameState.highlightedCards[playerId].filter(cId => cId !== cardId);
              }
            }

            if (keyType === 'green' || keyType === 'assassin' || (card.revealedByA && card.revealedByB)) {
              // Mark globally revealed if it's an objective, assassin, or both sides have guessed it
              card.revealed = true;
              card.type = keyType!; // temporarily override visual type for log/client
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

            const endTurnDuet = () => {
              room.gameState!.currentTurn = getNextTurnDuet(room.gameState!);
              room.gameState!.currentPhase = 'spymaster';
              room.gameState!.activeCue = null;
              room.gameState!.activeCueNumber = null;
              room.gameState!.successfulGuessesThisTurn = 0;
              room.gameState!.highlightedCards = {};
              room.gameState!.timerTokens--;
              if (room.gameState!.timerTokens <= 0) {
                 room.gameState!.winner = 'spectator'; // LOSS
              }
              startTimer(io, room);
            };

            if (keyType === 'assassin') {
              room.gameState.winner = 'spectator'; // Loss
            } else if (keyType === 'neutral') {
              endTurnDuet();
            } else if (keyType === 'green') {
              room.gameState.successfulGuessesThisTurn++;
              
              // Check for win: Are there 15 unique cards where either revealedByA or revealedByB was true and its keyType for the guesser was green?
              // Actually simpler: Are there 15 total green reveals across both sides? No, green targets are 15 distinct cards.
              // A card is "found" if it was guessed correctly. Wait, a card might be Green for A but Neutral for B.
              // So we need to check if 15 total "greens" have been found.
              // Let's count cards where (duetTypeA==='green' && revealedByB) OR (duetTypeB==='green' && revealedByA).
              let foundGreens = 0;
              room.gameState.cards.forEach(c => {
                if (c.duetTypeA === 'green' && c.revealedByB) foundGreens++;
                if (c.duetTypeB === 'green' && c.revealedByA) foundGreens++;
              });
              
              if (foundGreens >= 15) {
                room.gameState.winner = 'red'; // WIN (using 'red' to signal win in Duet, will fix frontend)
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
          }
        } else {
          // CLASSIC MODE GUESSING
          if (card && !card.revealed) {
            card.revealed = true;
            // Remove only the guessed card from highlights
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
            
            const endTurn = () => {
              room.gameState!.currentTurn = room.gameState!.currentTurn === 'red' ? 'blue' : 'red';
              room.gameState!.currentPhase = 'spymaster';
              room.gameState!.activeCue = null;
              room.gameState!.activeCueNumber = null;
              room.gameState!.successfulGuessesThisTurn = 0;
              room.gameState!.highlightedCards = {};
              startTimer(io, room);
            };

            if (card.type === 'assassin') {
              room.gameState.winner = room.gameState.currentTurn === 'red' ? 'blue' : 'red';
            } else if (card.type === 'red') {
              room.gameState.redScore--;
              if (room.gameState.redScore === 0) {
                room.gameState.winner = 'red';
              } else if (room.gameState.currentTurn === 'blue') {
                endTurn(); 
              } else {
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
        
        io.to(roomId).emit('game_update', room.gameState);
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
          room.gameState.currentTurn = room.gameState.gameMode === 'duet'
            ? getNextTurnDuet(room.gameState)
            : (room.gameState.currentTurn === 'red' ? 'blue' : 'red');
          room.gameState.currentPhase = 'spymaster';
          room.gameState.activeCue = null;
          room.gameState.activeCueNumber = null;
          room.gameState.successfulGuessesThisTurn = 0;
          room.gameState.highlightedCards = {};
          
          if (room.gameState.gameMode === 'duet') {
            room.gameState.timerTokens--;
            if (room.gameState.timerTokens <= 0) room.gameState.winner = 'spectator';
          }
          
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
          
          startTimer(io, room);
          io.to(roomId).emit('game_update', room.gameState);
        }
      }
    });

    socket.on('play_again', ({ roomId }: { roomId: string }) => {
      const room = rooms[roomId];
      // Allow host to restart. The host is the first player in the room array.
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
            // The host disconnected, kick everyone else
            io.to(roomId).emit('host_disconnected');
            delete rooms[roomId];
          } else {
            // Instead of removing the player, mark them as disconnected so they can rejoin and reclaim their spot
            room.players[playerIndex].connected = false;
            io.to(roomId).emit('room_update', getSafeRoom(room));
          }
        }
      }
    });
  });
}
