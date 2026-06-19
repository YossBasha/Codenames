import { Server, Socket } from "socket.io";
import {
  GameState,
  Player,
  Language,
  GameMode,
  TimerSettings,
  CustomWordWeight,
  Card as CardData,
} from "../../../shared/types";
import {
  generateGrid,
  generateDuetGrid,
  shuffleArray,
} from "../../../shared/gameLogic";
import { MODIFIERS, checkRhyme } from "../../../shared/modifiers";
import { wordPackRegistry } from "../../../shared/wordPacks";
import {
  getBotSpymasterClue,
  rankCardsForOperative,
  getLLMSpymasterClue,
  getLLMOperativeRankings,
} from "../utils/aiLogic";

interface Room {
  id: string;
  players: Player[];
  gameState: GameState | null;
  timerInterval?: NodeJS.Timeout;
  rogueAssassinInterval?: NodeJS.Timeout;
  settings?: any;
  isPublic?: boolean;
  hostSessionId?: string;
  deletionTimeout?: NodeJS.Timeout;
  returningToLobby?: boolean;
}

const rooms: Record<string, Room> = {};

function getPlayerAvatarUrl(player: Player, defaultBg?: string): string {
  if (player.avatarBase64) return player.avatarBase64;
  const bg = defaultBg || (player.team === "red" ? "ef4444" : "3b82f6");
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=${bg}`;
}

function getLoggedWord(room: Room, card: CardData): string {
  if (
    room.gameState &&
    room.gameState.activeModifier === "censored-documents" &&
    room.gameState.modifierState?.originalWords
  ) {
    const idx = room.gameState.cards.findIndex((c) => c.id === card.id);
    if (idx !== -1 && room.gameState.modifierState.originalWords[idx]) {
      return room.gameState.modifierState.originalWords[idx];
    }
  }
  return card.word;
}

const registeredRooms = new Map<string, { rooms: any[], lastSeen: number }>();

export function getLocalRoomsForRegistration() {
  return Object.values(rooms)
    .filter((r) => r.isPublic) // Only register public/WAN rooms
    .map((r) => ({
      roomID: r.id,
      players: r.players.length,
      hostName: r.players.length > 0 ? r.players[0].name : "Unknown",
      gameStarted: !!r.gameState,
      gameMode: r.gameState?.gameMode || "classic",
    }));
}

export function registerRooms(serverUrl: string, roomsList: any[]) {
  registeredRooms.set(serverUrl, {
    rooms: roomsList.map(r => ({ ...r, serverUrl })),
    lastSeen: Date.now()
  });
}

function getActiveRegisteredRooms() {
  const now = Date.now();
  const all: any[] = [];
  for (const [serverUrl, data] of registeredRooms.entries()) {
    if (now - data.lastSeen > 15000) {
      registeredRooms.delete(serverUrl);
    } else {
      all.push(...data.rooms);
    }
  }
  return all;
}

export function getPublicRooms() {
  const local = getLocalRoomsForRegistration();
  const external = getActiveRegisteredRooms();
  
  const merged = new Map<string, any>();
  for (const r of external) {
    merged.set(r.roomID, r);
  }
  for (const r of local) {
    merged.set(r.roomID, r);
  }
  return Array.from(merged.values());
}

function stopRogueAssassinInterval(room: Room) {
  if (room.rogueAssassinInterval) {
    clearInterval(room.rogueAssassinInterval);
    room.rogueAssassinInterval = undefined;
  }
}

function stopTimer(room: Room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = undefined;
  }
  stopRogueAssassinInterval(room);
}

function startRogueAssassinInterval(io: Server, room: Room) {
  stopRogueAssassinInterval(room);
  if (!room.gameState || room.gameState.winner) return;
  if (room.gameState.activeModifier !== "rogue-assassin") return;

  room.rogueAssassinInterval = setInterval(() => {
    const state = room.gameState;
    if (!state || state.winner || state.activeModifier !== "rogue-assassin") {
      stopRogueAssassinInterval(room);
      return;
    }

    const isDuet = state.gameMode === "duet";
    if (isDuet) {
      const expectedGuessTeam = state.currentTurn === "red" ? "blue" : "red";
      const guesserKey: 'duetTypeA' | 'duetTypeB' = expectedGuessTeam === "blue" ? "duetTypeA" : "duetTypeB";
      const revealedKey: 'revealedByA' | 'revealedByB' = expectedGuessTeam === "blue" ? "revealedByB" : "revealedByA";

      // Swap cards that are unrevealed for the guesser team
      const unrevealedAssassins = state.cards.filter(
        (c) => !c[revealedKey] && c[guesserKey] === "assassin"
      );
      const unrevealedNeutrals = state.cards.filter(
        (c) => !c[revealedKey] && c[guesserKey] === "neutral"
      );

      if (unrevealedAssassins.length > 0 && unrevealedNeutrals.length > 0) {
        const assassinCard = unrevealedAssassins[Math.floor(Math.random() * unrevealedAssassins.length)];
        const neutralCard = unrevealedNeutrals[Math.floor(Math.random() * unrevealedNeutrals.length)];

        // Swap ONLY the duetType corresponding to the guesser's key
        const temp = assassinCard[guesserKey];
        assassinCard[guesserKey] = neutralCard[guesserKey];
        neutralCard[guesserKey] = temp;
      }
    } else {
      // Classic mode
      const unrevealedAssassins = state.cards.filter((c) => !c.revealed && c.type === "assassin");
      const unrevealedNeutrals = state.cards.filter((c) => !c.revealed && c.type === "neutral");

      if (unrevealedAssassins.length > 0 && unrevealedNeutrals.length > 0) {
        const assassinCard = unrevealedAssassins[Math.floor(Math.random() * unrevealedAssassins.length)];
        const neutralCard = unrevealedNeutrals[Math.floor(Math.random() * unrevealedNeutrals.length)];

        const tempType = assassinCard.type;
        assassinCard.type = neutralCard.type;
        neutralCard.type = tempType;
      }
    }

    io.to(room.id).emit("game_update", state);
  }, 3000);
}

function getBotDelayMs(room: Room): number {
  if (room.gameState?.chaosMode) {
    return 5000;
  }
  return 2000;
}

function revertActiveModifier(room: Room) {
  const gameState = room.gameState;
  if (!gameState || !gameState.activeModifier) return;

  const modifier = gameState.activeModifier;
  const state = gameState.modifierState;

  if (modifier === "the-mimic") {
    if (state && state.mimicCardId !== undefined) {
      const card = gameState.cards.find((c) => c.id === state.mimicCardId);
      if (card) {
        if (gameState.gameMode === "duet") {
          if (state.originalType) {
            if (state.guesserTeam === "blue") {
              card.duetTypeA = state.originalType;
            } else {
              card.duetTypeB = state.originalType;
            }
          }
        } else {
          card.type = "neutral";
        }
      }
    }
  } else if (
    modifier === "lost-in-translation" ||
    modifier === "censored-documents"
  ) {
    if (state && state.originalWords) {
      gameState.cards.forEach((card, idx) => {
        if (state.originalWords![idx]) {
          card.word = state.originalWords![idx];
        }
      });
    }
  } else if (modifier === "nimnims-bite") {
    if (state && state.turnsLeft > 1) {
      state.turnsLeft--;
      return;
    }
    // NimNim's bite has finished its 2 turns.
    // Set a grace period flag on the room so it can't be activated next turn
    (room as any).nimnimGracePeriod = true;
  }

  gameState.activeModifier = null;
  gameState.modifierState = null;
}

function applyRandomModifier(room: Room) {
  const gameState = room.gameState;
  if (!gameState) return;
  if (gameState.activeModifier) {
    console.log(`[DEBUG CHAOS] activeModifier is already ${gameState.activeModifier}, skipping.`);
    return;
  }

  const enabled = gameState.enabledModifiers || MODIFIERS.map((m) => m.id);
  console.log(`[DEBUG CHAOS] enabledModifiers array:`, enabled);
  
  // Filter available modifiers, omitting "nimnims-bite" if the grace period flag is active
  let availableModifiers = MODIFIERS.filter((m) => enabled.includes(m.id));
  console.log(`[DEBUG CHAOS] after enabled filter, available length:`, availableModifiers.length);

  if ((room as any).nimnimGracePeriod) {
    availableModifiers = availableModifiers.filter((m) => m.id !== "nimnims-bite");
    console.log(`[DEBUG CHAOS] nimnimGracePeriod active, remaining available:`, availableModifiers.length);
    // Consume/reset the grace period flag for the next turn
    (room as any).nimnimGracePeriod = false;
  }

  if (availableModifiers.length === 0) {
    console.log(`[DEBUG CHAOS] NO MODIFIERS AVAILABLE! activeModifier set to null.`);
    gameState.activeModifier = null;
    gameState.modifierState = null;
    return;
  }

  const randomModifier =
    availableModifiers[Math.floor(Math.random() * availableModifiers.length)];
  console.log(`[DEBUG CHAOS] Chose random modifier:`, randomModifier.id);

  gameState.activeModifier = randomModifier.id;
  gameState.modifierState = {};

  if (randomModifier.id === "dimensional-scramble") {
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
        originalWords: gameState.cards.map((c) => c.word),
      };

      const tempWord = gameState.cards[idx1].word;
      gameState.cards[idx1].word = gameState.cards[idx2].word;
      gameState.cards[idx2].word = gameState.cards[idx3].word;
      gameState.cards[idx3].word = tempWord;
    }
  } else if (randomModifier.id === "the-mimic") {
    const neutralIndices: number[] = [];
    const isDuet = gameState.gameMode === "duet";
    const expectedGuessTeam = isDuet
      ? gameState.currentTurn === "red"
        ? "blue"
        : "red"
      : gameState.currentTurn;

    gameState.cards.forEach((c, idx) => {
      if (isDuet) {
        const keyType =
          expectedGuessTeam === "blue" ? c.duetTypeA : c.duetTypeB;
        const alreadyRevealed =
          expectedGuessTeam === "blue" ? c.revealedByB : c.revealedByA;
        if (!alreadyRevealed && keyType === "neutral") {
          neutralIndices.push(idx);
        }
      } else {
        if (!c.revealed && c.type === "neutral") {
          neutralIndices.push(idx);
        }
      }
    });

    if (neutralIndices.length > 0) {
      const randomIdx =
        neutralIndices[Math.floor(Math.random() * neutralIndices.length)];
      const card = gameState.cards[randomIdx];
      if (isDuet) {
        gameState.modifierState = {
          mimicCardId: card.id,
          originalType: "neutral",
          guesserTeam: expectedGuessTeam,
        };
        if (expectedGuessTeam === "blue") {
          card.duetTypeA = "assassin";
        } else {
          card.duetTypeB = "assassin";
        }
      } else {
        gameState.modifierState = {
          mimicCardId: card.id,
          originalType: "neutral",
        };
        card.type = "assassin";
      }
    }
  } else if (randomModifier.id === "blood-pact") {
    gameState.modifierState = {
      bloodPactStatus: "available",
    };
  } else if (randomModifier.id === "shield-wall") {
    gameState.modifierState = {
      shieldActive: true,
    };
  } else if (randomModifier.id === "gacha-pull") {
    gameState.modifierState = {
      gachaChances: generateGachaChances(gameState),
    };
  } else if (randomModifier.id === "d20-roll") {
    gameState.modifierState = {
      rolled: false,
      result: null,
    };
  } else if (randomModifier.id === "lost-in-translation") {
    let targetLang = "en";
    if (gameState.language === "en") {
      const options = ["ar", "du", "ge", "fr", "es"];
      targetLang = options[Math.floor(Math.random() * options.length)];
    } else {
      targetLang = "en";
    }

    gameState.modifierState = {
      originalWords: gameState.cards.map((c) => c.word),
      targetLanguage: targetLang,
    };

    gameState.cards.forEach((card) => {
      if (card.revealed) return;
      const sourcePacks = wordPackRegistry[gameState.language];
      const targetPacks = wordPackRegistry[targetLang];

      let found = false;
      for (const packName in sourcePacks) {
        const packWords = sourcePacks[packName];
        const idx = packWords.indexOf(card.word);
        if (
          idx !== -1 &&
          targetPacks[packName] &&
          targetPacks[packName].length > 0
        ) {
          // If the target pack is missing words (shorter than source pack), wrap around to ensure a translation
          const targetIdx = idx % targetPacks[packName].length;
          card.word = targetPacks[packName][targetIdx];
          found = true;
          break;
        }
      }
    });
  } else if (randomModifier.id === "censored-documents") {
    gameState.modifierState = {
      originalWords: gameState.cards.map((c) => c.word),
    };

    gameState.cards.forEach((card) => {
      if (card.revealed) return;

      if (/\p{Emoji}/u.test(card.word)) return;

      const chars = card.word.split("");
      const numToRedact = Math.max(
        1,
        Math.floor(chars.length * (Math.random() * 0.2 + 0.3)),
      ); // 30-50%
      let redactedCount = 0;
      while (redactedCount < numToRedact) {
        const randIdx = Math.floor(Math.random() * chars.length);
        if (chars[randIdx] !== "█" && chars[randIdx] !== " ") {
          chars[randIdx] = "█";
          redactedCount++;
        }
      }
      card.word = chars.join("");
    });
  } else if (randomModifier.id === "hall-of-mirrors") {
    const unrevealedCards = gameState.cards.filter((c) => !c.revealed);
    if (unrevealedCards.length >= 2) {
      const shuffled = shuffleArray([...unrevealedCards]);
      gameState.modifierState = {
        illusionCardId: shuffled[1].id,
        illusionWord: shuffled[0].word,
      };
    }
  } else if (randomModifier.id === "poltergeist") {
    const unrevealedCards = gameState.cards.filter((c) => !c.revealed);
    const numToInvert = Math.floor(unrevealedCards.length / 2);
    if (numToInvert > 0) {
      const shuffled = shuffleArray([...unrevealedCards]);
      gameState.modifierState = {
        invertedCardIds: shuffled.slice(0, numToInvert).map((c) => c.id),
      };
    }
  } else if (randomModifier.id === "earthquake") {
    gameState.modifierState = {
      originalWords: gameState.cards.map((c) => c.word),
      originalCards: JSON.parse(JSON.stringify(gameState.cards)),
    };

    const unrevealedCards = gameState.cards.filter((c) => !c.revealed);
    const unrevealedWords = unrevealedCards.map((c) => c.word);

    const shuffledWords = shuffleArray([...unrevealedWords]);

    interface CardData {
      word: string;
      type: string;
      duetTypeA?: string;
      duetTypeB?: string;
    }

    const unrevealedData: CardData[] = unrevealedCards.map((c) => ({
      word: c.word,
      type: c.type,
      duetTypeA: c.duetTypeA,
      duetTypeB: c.duetTypeB,
    }));

    const shuffledData = shuffleArray([...unrevealedData]);

    let shuffleIdx = 0;
    gameState.cards.forEach((c) => {
      if (!c.revealed) {
        const data = shuffledData[shuffleIdx++];
        c.word = data.word;
        c.type = data.type as any;
        c.duetTypeA = data.duetTypeA as any;
        c.duetTypeB = data.duetTypeB as any;
      }
    });
  } else if (randomModifier.id === "forced-acronym") {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const arabicLetters = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي";
    const useArabic = gameState.language === "ar";
    const alphabet = useArabic ? arabicLetters : letters;

    const seq = Array.from(
      { length: 3 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join("-");
    gameState.modifierState = { acronym: seq };
  } else if (randomModifier.id === "the-dictator") {
    const numbers = [4, 5, 6];
    const forcedNumber = numbers[Math.floor(Math.random() * numbers.length)];
    gameState.modifierState = { forcedNumber };
  } else if (randomModifier.id === "nimnims-bite") {
    const unrevealedIndices: number[] = [];
    gameState.cards.forEach((c, idx) => {
      if (!c.revealed) {
        unrevealedIndices.push(idx);
      }
    });
    const count = Math.min(3, unrevealedIndices.length);
    const shuffled = shuffleArray([...unrevealedIndices]);
    const eatenCardIds = shuffled.slice(0, count).map((idx) => gameState.cards[idx].id);
    gameState.modifierState = {
      eatenCardIds,
      turnsLeft: 2,
    };
  }
}

function generateGachaChances(gameState: any) {
  const isDuet = gameState.gameMode === "duet";
  const expectedGuessTeam = isDuet
    ? gameState.currentTurn === "red"
      ? "blue"
      : "red"
    : gameState.currentTurn;

  let hasCorrect = false;
  let hasAssassin = false;
  let hasEnemy = false;
  let hasNeutral = false;

  gameState.cards.forEach((c: any) => {
    if (isDuet) {
      const type = expectedGuessTeam === "blue" ? c.duetTypeA : c.duetTypeB;
      const revealed =
        expectedGuessTeam === "blue" ? c.revealedByB : c.revealedByA;
      if (!revealed) {
        if (type === "green") hasCorrect = true;
        else if (type === "assassin") hasAssassin = true;
        else if (type === "neutral") hasNeutral = true;
      }
    } else {
      if (!c.revealed) {
        if (c.type === expectedGuessTeam) hasCorrect = true;
        else if (c.type === "assassin") hasAssassin = true;
        else if (c.type === "neutral") hasNeutral = true;
        else hasEnemy = true;
      }
    }
  });

  const chances = {
    correct: hasCorrect ? Math.random() : 0,
    assassin: hasAssassin ? Math.random() : 0,
    enemy: hasEnemy ? Math.random() : 0,
    neutral: hasNeutral ? Math.random() : 0,
  };

  const total =
    chances.correct + chances.assassin + chances.enemy + chances.neutral;
  if (total === 0) return null;

  let sum = 0;
  for (const k of ["correct", "assassin", "enemy", "neutral"] as const) {
    chances[k] = Math.round((chances[k] / total) * 100);
    sum += chances[k];
  }

  if (sum !== 100) {
    const diff = 100 - sum;
    let maxK: "correct" | "assassin" | "enemy" | "neutral" = "correct";
    let maxVal = -1;
    for (const k of ["correct", "assassin", "enemy", "neutral"] as const) {
      if (chances[k] > maxVal) {
        maxVal = chances[k];
        maxK = k;
      }
    }
    chances[maxK] += diff;
  }

  return chances;
}

function transitionToNewTurn(io: Server, room: Room) {
  const gameState = room.gameState;
  if (!gameState) return;

  revertActiveModifier(room);

  let nextTurn =
    gameState.gameMode === "duet"
      ? getNextTurnDuet(gameState)
      : gameState.currentTurn === "red"
        ? "blue"
        : "red";

  // --- Intercept Penalty: skip this team's turn ---
  if (
    gameState.modifierState?.interceptPenalty === nextTurn &&
    gameState.gameMode === "classic"
  ) {
    const penaltyTeam = nextTurn;
    gameState.modifierState.interceptPenalty = null;

    // Switch to the team AFTER the penalised one
    nextTurn = penaltyTeam === "red" ? "blue" : "red";

    gameState.gameLog.push({
      id: Math.random().toString(36).substring(7),
      type: "guess",
      player: {
        name: "⚡ The Intercept",
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=intercept&backgroundColor=7c3aed`,
      },
      guessingTeam: penaltyTeam as "red" | "blue",
      cardWord: `${penaltyTeam === "red" ? "🔴 Red" : "🔵 Blue"} team received the intercept penalty — their turn has been skipped!`,
      revealedColor: "neutral",
      timestamp: Date.now(),
    });
  }
  // ------------------------------------------------

  gameState.currentTurn = nextTurn;
  gameState.currentPhase = "spymaster";
  gameState.activeCue = null;
  gameState.activeCueNumber = null;
  gameState.successfulGuessesThisTurn = 0;
  gameState.highlightedCards = {};

  gameState.cards.forEach((card) => {
    if (card.shieldedTurns && card.shieldedTurns > 0) {
      card.shieldedTurns--;
    }
  });

  if (gameState.gameMode === "duet") {
    gameState.timerTokens--;
    if (gameState.timerTokens <= 0) {
      gameState.winner = "spectator";
    }
  }

  if (gameState.chaosMode) {
    applyRandomModifier(room);
  }

  startTimer(io, room);

  // Trigger Spymaster Bot if applicable
  if (gameState.currentPhase === "spymaster") {
    const spymasterBots = room.players.filter(
      (p) =>
        p.team === gameState.currentTurn && p.role === "spymaster" && p.isBot,
    );
    if (spymasterBots.length > 0) {
      setTimeout(
        () => triggerBotSpymaster(io, room, spymasterBots[0]),
        getBotDelayMs(room),
      );
    }
  }
}

async function triggerBotSpymaster(io: Server, room: Room, bot: Player) {
  const gameState = room.gameState;
  console.log(
    `[BOT-SPY] triggerBotSpymaster called. Bot: ${bot.name} (${bot.team}), Phase: ${gameState?.currentPhase}, Turn: ${gameState?.currentTurn}, Winner: ${gameState?.winner}`,
  );

  if (
    !gameState ||
    gameState.currentPhase !== "spymaster" ||
    gameState.winner
  ) {
    console.warn(
      `[BOT-SPY] Early exit — gameState invalid or wrong phase/winner.`,
    );
    return;
  }

  stopTimer(room); // Pause timer during API call

  io.to(room.id).emit("chat_message", {
    id: Date.now().toString(),
    text: `${bot.name} is thinking of a clue...`,
    sender: "System",
    isSystem: true,
    team: bot.team,
    timestamp: Date.now(),
  });

  try {
    console.log(
      `[BOT-SPY] Calling getLLMSpymasterClue for team ${bot.team}...`,
    );
    const clue = await getLLMSpymasterClue(
      gameState.cards,
      bot.team as any,
      gameState.language,
      gameState.gameMode === "duet",
      gameState.activeModifier,
      gameState.modifierState,
    );
    console.log(`[BOT-SPY] getLLMSpymasterClue returned:`, clue);

    if (
      !room.gameState ||
      room.gameState.currentPhase !== "spymaster" ||
      room.gameState.winner
    ) {
      console.warn(`[BOT-SPY] State changed while awaiting clue — aborting.`);
      return;
    }

    if (clue) {
      console.log(
        `[BOT-SPY] Using clue "${clue.word}" for ${clue.count}. Transitioning to operative phase.`,
      );
      room.gameState.activeCue = clue.word;
      room.gameState.activeCueNumber = clue.count;
      room.gameState.currentPhase = "operative";
      room.gameState.successfulGuessesThisTurn = 0;

      room.gameState.gameLog.push({
        id: Math.random().toString(36).substring(7),
        type: "cue",
        player: { name: bot.name, avatarUrl: bot.avatarBase64! },
        team: bot.team as "red" | "blue",
        cueWord: clue.word,
        cueNumber: clue.count,
        reasoning: clue.reasoning,
        timestamp: Date.now(),
      });

      if (
        room.gameState.activeModifier === "the-intercept" &&
        room.gameState.gameMode === "classic"
      ) {
        if (!room.gameState.modifierState) room.gameState.modifierState = {};
        room.gameState.modifierState.interceptPhase = true;
        room.gameState.modifierState.interceptTimeLeft = 5;

        const interceptInterval = setInterval(() => {
          if (
            !room.gameState ||
            room.gameState.modifierState?.interceptPhase !== true
          ) {
            clearInterval(interceptInterval);
            return;
          }
          room.gameState.modifierState.interceptTimeLeft--;
          if (room.gameState.modifierState.interceptTimeLeft <= 0) {
            room.gameState.modifierState.interceptPhase = false;
            room.gameState.modifierState.interceptTimeLeft = 0;
            clearInterval(interceptInterval);
            startTimer(io, room);

            const operativeBots = room.players.filter(
              (p) =>
                p.team === room.gameState!.currentTurn &&
                p.role === "operative" &&
                p.isBot,
            );
            if (operativeBots.length > 0) {
              setTimeout(
                () =>
                  triggerBotOperatives(
                    io,
                    room,
                    room.gameState!.activeCue || "",
                    room.gameState!.activeCueNumber || 1,
                    operativeBots[0],
                  ),
                getBotDelayMs(room),
              );
            }
          }
          io.to(room.id).emit("game_update", room.gameState);
        }, 1000);

        io.to(room.id).emit("game_update", room.gameState);
        return;
      }

      startTimer(io, room);
      io.to(room.id).emit("game_update", room.gameState);

      // Trigger Operative bots if applicable
      const operativeBots = room.players.filter(
        (p) =>
          p.team ===
            (room.gameState!.gameMode === "duet"
              ? room.gameState!.currentTurn === "red"
                ? "blue"
                : "red"
              : room.gameState!.currentTurn) &&
          p.role === "operative" &&
          p.isBot,
      );
      console.log(
        `[BOT-SPY] Found ${operativeBots.length} operative bot(s) for team ${room.gameState.currentTurn}.`,
      );
      if (operativeBots.length > 0) {
        setTimeout(
          () =>
            triggerBotOperatives(
              io,
              room,
              clue.word,
              clue.count,
              operativeBots[0],
            ),
          getBotDelayMs(room),
        );
      }
    } else {
      console.error(
        `[BOT-SPY] Clue was null/undefined — throwing to trigger fallback.`,
      );
      throw new Error("No clue generated");
    }
  } catch (error) {
    console.error("[BOT-SPY] CATCH ERROR:", error);
    if (
      !room.gameState ||
      room.gameState.currentPhase !== "spymaster" ||
      room.gameState.winner
    ) {
      console.warn(
        `[BOT-SPY] State invalid in catch block — not transitioning.`,
      );
      return;
    }
    io.to(room.id).emit("chat_message", {
      id: Date.now().toString(),
      text: `${bot.name} couldn't find a safe clue and passed the turn.`,
      sender: "System",
      isSystem: true,
      team: bot.team,
      timestamp: Date.now(),
    });
    console.warn(`[BOT-SPY] Calling transitionToNewTurn due to error.`);
    transitionToNewTurn(io, room);
    io.to(room.id).emit("game_update", room.gameState);
  }
}

async function triggerBotOperatives(
  io: Server,
  room: Room,
  clue: string,
  count: number,
  bot: Player,
) {
  const gameState = room.gameState;
  console.log(
    `[BOT-OP] triggerBotOperatives called. Bot: ${bot.name} (${bot.team}), Clue: "${clue}" x${count}, Phase: ${gameState?.currentPhase}, ActiveCue: ${gameState?.activeCue}`,
  );

  if (
    !gameState ||
    gameState.currentPhase !== "operative" ||
    gameState.winner ||
    gameState.activeCue !== clue
  ) {
    console.warn(
      `[BOT-OP] Early exit — gameState invalid, wrong phase, winner set, or clue mismatch. Expected cue: "${clue}", Actual: "${gameState?.activeCue}"`,
    );
    return;
  }

  stopTimer(room); // Pause timer during API call

  io.to(room.id).emit("chat_message", {
    id: Date.now().toString(),
    text: `${bot.name} is examining the board...`,
    sender: "System",
    isSystem: true,
    team: bot.team,
    timestamp: Date.now(),
  });

  try {
    console.log(
      `[BOT-OP] Calling getLLMOperativeRankings for clue "${clue}"...`,
    );
    const { cards: rankedCards, reasoning } = await getLLMOperativeRankings(
      clue,
      count,
      gameState.cards,
      bot.team as any,
      gameState.language,
      gameState.gameMode === "duet",
      gameState.activeModifier,
      gameState.modifierState,
    );
    console.log(
      `[BOT-OP] Ranked ${rankedCards.length} cards. Reasoning: ${reasoning}. Top 3:`,
      rankedCards.slice(0, 3).map((c) => c.word),
    );

    if (reasoning) {
      io.to(room.id).emit("chat_message", {
        id: Date.now().toString(),
        text: `Inner Monologue: ${reasoning}`,
        sender: bot.name,
        isSystem: false,
        team: bot.team,
        timestamp: Date.now(),
      });
    }

    if (
      !room.gameState ||
      room.gameState.currentPhase !== "operative" ||
      room.gameState.winner ||
      room.gameState.activeCue !== clue
    ) {
      console.warn(
        `[BOT-OP] State changed while awaiting rankings — aborting.`,
      );
      return;
    }

    if (rankedCards.length === 0) {
      throw new Error("No cards ranked");
    }

    startTimer(io, room); // Resume timer for actual clicking

    // Emulate clicking top cards one by one with a delay
    // Calculate how many guesses allowed (count + 1)
    const maxGuesses = count === 0 ? 99 : count + 1;
    const numGuesses = Math.min(maxGuesses, rankedCards.length);
    console.log(
      `[BOT-OP] Will guess up to ${numGuesses} cards (maxGuesses: ${maxGuesses}).`,
    );

    let i = 0;

    function nextGuess() {
      const currentGameState = room.gameState;
      if (
        !currentGameState ||
        currentGameState.currentPhase !== "operative" ||
        currentGameState.winner ||
        currentGameState.activeCue !== clue
      ) {
        console.warn(
          `[BOT-OP] nextGuess: exiting — state changed or cue no longer active.`,
        );
        return;
      }

      // Check if we hit the limit or successful guesses exhausted
      if (currentGameState.successfulGuessesThisTurn >= maxGuesses) {
        console.log(
          `[BOT-OP] nextGuess: successfulGuesses (${currentGameState.successfulGuessesThisTurn}) >= maxGuesses (${maxGuesses}), stopping.`,
        );
        return;
      }

      if (i >= numGuesses) {
        // Bot is done guessing and decides to pass voluntarily
        console.log(
          `[BOT-OP] nextGuess: reached numGuesses (${numGuesses}), passing turn.`,
        );
        transitionToNewTurn(io, room);
        io.to(room.id).emit("game_update", currentGameState);
        return;
      }

      const targetCard = rankedCards[i];
      console.log(
        `[BOT-OP] nextGuess: guessing card [${i}] = "${targetCard.word}"`,
      );
      i++;

      // Only click if it's still unrevealed
      const stillUnrevealed =
        currentGameState.gameMode === "duet"
          ? bot.team === "blue"
            ? !targetCard.revealedByB
            : !targetCard.revealedByA
          : !targetCard.revealed;

      if (stillUnrevealed) {
        // Synthesize a guess event
        processGuess(io, room, bot, targetCard.id);
      } else {
        console.warn(
          `[BOT-OP] Card "${targetCard.word}" was already revealed, skipping.`,
        );
      }

      // Schedule next guess if it's still the bot's turn
      if (
        room.gameState &&
        room.gameState.currentPhase === "operative" &&
        room.gameState.activeCue === clue
      ) {
        const guessDelayMs = room.gameState?.chaosMode
          ? 3000 + Math.random() * 1000
          : 2000 + Math.random() * 2000;
        setTimeout(nextGuess, guessDelayMs);
      }
    }

    nextGuess();
  } catch (error) {
    console.error("[BOT-OP] CATCH ERROR:", error);
    if (
      !room.gameState ||
      room.gameState.currentPhase !== "operative" ||
      room.gameState.winner ||
      room.gameState.activeCue !== clue
    ) {
      console.warn(
        `[BOT-OP] State invalid in catch block — not transitioning.`,
      );
      return;
    }

    io.to(room.id).emit("chat_message", {
      id: Date.now().toString(),
      text: `${bot.name} couldn't understand the board and passed the turn.`,
      sender: "System",
      isSystem: true,
      team: bot.team,
      timestamp: Date.now(),
    });
    console.warn(`[BOT-OP] Calling transitionToNewTurn due to error.`);
    transitionToNewTurn(io, room);
    io.to(room.id).emit("game_update", room.gameState);
  }
}

function startTimer(io: Server, room: Room) {
  stopTimer(room);
  if (!room.gameState) return;

  if (room.gameState.activeModifier === "rogue-assassin" && !room.gameState.winner) {
    startRogueAssassinInterval(io, room);
  }

  const isHaste =
    room.gameState.activeModifier === "haste" &&
    room.gameState.currentPhase === "operative";
  if (room.gameState.timerSettings.preset === "off" && !isHaste) return;

  let duration = 0;
  if (isHaste) {
    duration = 15;
  } else if (room.gameState.currentPhase === "spymaster") {
    duration = room.gameState.timerSettings.spymasterTime;
    if (room.gameState.isFirstTurnOfGame) {
      duration += room.gameState.timerSettings.extraFirstClueTime;
    }
  } else {
    duration = room.gameState.timerSettings.operativeTime;
  }

  room.gameState.timeRemaining = duration;
  io.to(room.id).emit("timer_tick", room.gameState.timeRemaining);

  room.timerInterval = setInterval(() => {
    if (!room.gameState || room.gameState.winner) {
      stopTimer(room);
      return;
    }

    const isTimerFrozen =
      room.gameState.activeModifier === "critical-hit" &&
      room.gameState.modifierState?.timerFrozen;

    if (!isTimerFrozen) {
      room.gameState.timeRemaining--;
    }
    io.to(room.id).emit("timer_tick", room.gameState.timeRemaining);

    if (room.gameState.timeRemaining <= 0) {
      stopTimer(room);

      if (room.gameState.currentPhase === "spymaster") {
        room.gameState.activeCue = "";
        room.gameState.activeCueNumber = 0;
        room.gameState.currentPhase = "operative";
        room.gameState.successfulGuessesThisTurn = 0;

        room.gameState.gameLog.push({
          id: Math.random().toString(36).substring(7),
          type: "guess",
          player: {
            name: "System",
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=System&backgroundColor=333333`,
          },
          guessingTeam: room.gameState.currentTurn as "red" | "blue",
          cardWord: "Timer Expired",
          revealedColor: "neutral",
          timestamp: Date.now(),
        });

        io.to(room.id).emit("game_update", room.gameState);
        startTimer(io, room);
      } else {
        room.gameState.gameLog.push({
          id: Math.random().toString(36).substring(7),
          type: "guess",
          player: {
            name: "System",
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=System&backgroundColor=333333`,
          },
          guessingTeam: room.gameState.currentTurn as "red" | "blue",
          cardWord: "Turn Ended (Timer)",
          revealedColor: "neutral",
          timestamp: Date.now(),
        });

        transitionToNewTurn(io, room);
        io.to(room.id).emit("game_update", room.gameState);
      }
    }
  }, 1000);
}

function getSafeRoom(room: Room) {
  const { timerInterval, rogueAssassinInterval, ...safeRoom } = room;
  return safeRoom;
}

function getNextTurnDuet(gameState: GameState): "red" | "blue" {
  let nextTurn: "red" | "blue" =
    gameState.currentTurn === "red" ? "blue" : "red";
  if (nextTurn === "red") {
    const aRemaining = gameState.cards.filter(
      (c) => c.duetTypeA === "green" && !c.revealedByB,
    ).length;
    if (aRemaining === 0) return "blue";
  } else {
    const bRemaining = gameState.cards.filter(
      (c) => c.duetTypeB === "green" && !c.revealedByA,
    ).length;
    if (bRemaining === 0) return "red";
  }
  return nextTurn;
}

function processGuess(io: Server, room: Room, player: Player, cardId: number) {
  if (!room.gameState || room.gameState.winner) return;
  if (room.gameState.currentPhase !== "operative") return;

  const isDuet = room.gameState.gameMode === "duet";
  const expectedGuessTeam = isDuet
    ? room.gameState.currentTurn === "red"
      ? "blue"
      : "red"
    : room.gameState.currentTurn;

  if (
    player.team !== expectedGuessTeam ||
    (!isDuet && player.role !== "operative")
  )
    return;

  if (
    room.gameState.activeModifier === "nimnims-bite" &&
    room.gameState.modifierState?.eatenCardIds?.includes(cardId)
  ) {
    return;
  }

  const baseAllowed = (room.gameState.activeCueNumber || 0) + 1;
  const maxGuesses =
    room.gameState.activeCueNumber === 99
      ? Infinity
      : room.gameState.activeModifier === "mutiny" &&
          room.gameState.modifierState?.mutinyUsed
        ? baseAllowed - 1
        : baseAllowed;

  if (room.gameState.successfulGuessesThisTurn >= maxGuesses) return;

  // Implement Slippery Fingers
  let actualCardId = cardId;
  if (
    room.gameState.activeModifier === "slippery-fingers" &&
    Math.random() < 0.25
  ) {
    const targetIndex = room.gameState.cards.findIndex((c) => c.id === cardId);
    if (targetIndex !== -1) {
      const row = Math.floor(targetIndex / 5);
      const col = targetIndex % 5;
      const neighbors: number[] = [];

      for (let r = Math.max(0, row - 1); r <= Math.min(4, row + 1); r++) {
        for (let c = Math.max(0, col - 1); c <= Math.min(4, col + 1); c++) {
          if (r === row && c === col) continue;

          const neighborIdx = r * 5 + c;
          const neighborCard = room.gameState.cards[neighborIdx];

          const isRevealed = isDuet
            ? expectedGuessTeam === "blue"
              ? neighborCard.revealedByB
              : neighborCard.revealedByA
            : neighborCard.revealed;

          if (
            !isRevealed &&
            !(neighborCard.shieldedTurns && neighborCard.shieldedTurns > 0)
          ) {
            neighbors.push(neighborCard.id);
          }
        }
      }

      if (neighbors.length > 0) {
        actualCardId = neighbors[Math.floor(Math.random() * neighbors.length)];

        // Broadcast the slip event to clients for visual feedback (optional)
        io.to(room.id).emit("chat_message", {
          id: Date.now().toString(),
          text: `Whoops! ${player.name}'s finger slipped...`,
          sender: "System",
          isSystem: true,
          team: player.team,
          timestamp: Date.now(),
        });
      }
    }
  }

  const card = room.gameState.cards.find((c) => c.id === actualCardId);
  if (!card) return;

  if (card.shieldedTurns && card.shieldedTurns > 0) return;

  const endTurn = () => {
    transitionToNewTurn(io, room);
  };

  const endTurnDuet = () => {
    transitionToNewTurn(io, room);
  };

  if (isDuet) {
    const alreadyRevealed =
      expectedGuessTeam === "blue" ? card.revealedByB : card.revealedByA;
    if (alreadyRevealed) return;

    const keyType =
      expectedGuessTeam === "blue" ? card.duetTypeA : card.duetTypeB;
    if (expectedGuessTeam === "blue") card.revealedByB = true;
    else card.revealedByA = true;

    if (room.gameState.highlightedCards) {
      for (const playerId of Object.keys(room.gameState.highlightedCards)) {
        room.gameState.highlightedCards[playerId] =
          room.gameState.highlightedCards[playerId].filter(
            (cId) => cId !== cardId,
          );
      }
    }

    if (
      keyType === "green" ||
      keyType === "assassin" ||
      (card.revealedByA && card.revealedByB)
    ) {
      card.revealed = true;
      card.type = keyType!;
    }

    room.gameState.gameLog.push({
      id: Math.random().toString(36).substring(7),
      type: "guess",
      player: {
        name: player.name,
        avatarUrl: getPlayerAvatarUrl(player),
      },
      guessingTeam: expectedGuessTeam as "red" | "blue",
      cardWord: getLoggedWord(room, card),
      revealedColor: keyType!,
      timestamp: Date.now(),
    });

    if (keyType === "assassin") {
      room.gameState.winner = "spectator";
    } else if (keyType === "neutral") {
      endTurnDuet();
    } else if (keyType === "green") {
      if (
        room.gameState.activeModifier === "critical-hit" &&
        room.gameState.successfulGuessesThisTurn === 0 &&
        room.gameState.timerSettings.preset !== "off"
      ) {
        const duration = room.gameState.timerSettings.operativeTime;
        if (room.gameState.timeRemaining >= duration - 5) {
          if (!room.gameState.modifierState) room.gameState.modifierState = {};
          room.gameState.modifierState.timerFrozen = true;
        }
      }

      room.gameState.successfulGuessesThisTurn++;

      let foundGreens = 0;
      room.gameState.cards.forEach((c) => {
        if (c.duetTypeA === "green" && c.revealedByB) foundGreens++;
        if (c.duetTypeB === "green" && c.revealedByA) foundGreens++;
      });

      if (foundGreens >= 15) {
        room.gameState.winner = "red";
      } else {
        let remainingTargetsForCurrentTeam = 0;
        if (expectedGuessTeam === "blue") {
          remainingTargetsForCurrentTeam = room.gameState.cards.filter(
            (c) => c.duetTypeA === "green" && !c.revealedByB,
          ).length;
        } else {
          remainingTargetsForCurrentTeam = room.gameState.cards.filter(
            (c) => c.duetTypeB === "green" && !c.revealedByA,
          ).length;
        }

        if (
          remainingTargetsForCurrentTeam === 0 ||
          room.gameState.successfulGuessesThisTurn >= maxGuesses
        ) {
          endTurnDuet();
        }
      }
    }
  } else {
    if (!card.revealed) {
      card.revealed = true;
      if (room.gameState.highlightedCards) {
        for (const playerId of Object.keys(room.gameState.highlightedCards)) {
          room.gameState.highlightedCards[playerId] =
            room.gameState.highlightedCards[playerId].filter(
              (cId) => cId !== cardId,
            );
        }
      }

      room.gameState.gameLog.push({
        id: Math.random().toString(36).substring(7),
        type: "guess",
        player: {
          name: player.name,
          avatarUrl: getPlayerAvatarUrl(player),
        },
        guessingTeam: expectedGuessTeam as "red" | "blue",
        cardWord: getLoggedWord(room, card),
        revealedColor: card.type,
        timestamp: Date.now(),
      });

      if (card.type === "assassin") {
        room.gameState.winner =
          room.gameState.currentTurn === "red" ? "blue" : "red";
      } else if (card.type === "red") {
        room.gameState.redScore--;
        if (room.gameState.redScore === 0) {
          room.gameState.winner = "red";
        } else if (room.gameState.currentTurn === "blue") {
          endTurn();
        } else {
          if (
            room.gameState.activeModifier === "critical-hit" &&
            room.gameState.successfulGuessesThisTurn === 0 &&
            room.gameState.timerSettings.preset !== "off"
          ) {
            const duration = room.gameState.timerSettings.operativeTime;
            if (room.gameState.timeRemaining >= duration - 5) {
              if (!room.gameState.modifierState)
                room.gameState.modifierState = {};
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
      } else if (card.type === "blue") {
        room.gameState.blueScore--;
        if (room.gameState.blueScore === 0) {
          room.gameState.winner = "blue";
        } else if (room.gameState.currentTurn === "red") {
          endTurn();
        } else {
          if (
            room.gameState.activeModifier === "critical-hit" &&
            room.gameState.successfulGuessesThisTurn === 0 &&
            room.gameState.timerSettings.preset !== "off"
          ) {
            const duration = room.gameState.timerSettings.operativeTime;
            if (room.gameState.timeRemaining >= duration - 5) {
              if (!room.gameState.modifierState)
                room.gameState.modifierState = {};
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
      } else if (card.type === "neutral") {
        endTurn();
      }
    }
  }

  if (
    room.gameState &&
    !room.gameState.winner &&
    room.gameState.modifierState?.bloodPactOneGuessLeft
  ) {
    if (room.gameState.currentPhase === "operative") {
      transitionToNewTurn(io, room);
    }
  }

  io.to(room.id).emit("game_update", room.gameState);
}

export function setupRoomManager(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("join_room_as_observer", (roomId: string) => {
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
        team: "spectator",
        role: "spectator",
      };

      const existingPlayerIndex = rooms[roomId].players.findIndex(
        (p) => p.id === newPlayer.id,
      );
      if (existingPlayerIndex !== -1) {
        rooms[roomId].players[existingPlayerIndex] = newPlayer;
      } else {
        rooms[roomId].players.push(newPlayer);
      }

      socket.emit("room_update", getSafeRoom(rooms[roomId]));
      if (rooms[roomId].settings) {
        socket.emit("settings_updated", rooms[roomId].settings);
      }
      if (rooms[roomId].gameState) {
        socket.emit("game_started", rooms[roomId].gameState);
      }
    });

    socket.on(
      "join_room",
      ({
        roomId,
        player,
        explicitChange,
        isPublic,
      }: {
        roomId: string;
        player: Player;
        explicitChange?: boolean;
        isPublic?: boolean;
      }) => {
        socket.join(roomId);

        if (!rooms[roomId]) {
          rooms[roomId] = {
            id: roomId,
            players: [],
            gameState: null,
            hostSessionId: player.sessionId || player.id,
            isPublic: !!isPublic
          };
        } else {
          if (isPublic !== undefined) {
            rooms[roomId].isPublic = !!isPublic;
          }
          if (rooms[roomId].deletionTimeout) {
            clearTimeout(rooms[roomId].deletionTimeout);
            rooms[roomId].deletionTimeout = undefined;
            console.log(`Host re-joined room ${roomId}. Deletion cancelled.`);
          }
          // Clear the lobby-transition flag when players start reconnecting
          if (rooms[roomId].returningToLobby) {
            rooms[roomId].returningToLobby = false;
          }
        }

        const existingPlayerIndex = rooms[roomId].players.findIndex(
          (p) =>
            (player.sessionId && p.sessionId === player.sessionId) ||
            p.id === player.id,
        );

        if (existingPlayerIndex !== -1) {
          const existingPlayer = rooms[roomId].players[existingPlayerIndex];

          rooms[roomId].players[existingPlayerIndex] = {
            ...existingPlayer,
            id: player.id,
            name: player.name,
            team: explicitChange ? player.team : existingPlayer.team,
            role: explicitChange ? player.role : existingPlayer.role,
            connected: true,
          };
        } else {
          rooms[roomId].players.push({
            ...player,
            connected: true,
          });
        }

        io.to(roomId).emit("room_update", getSafeRoom(rooms[roomId]));
        if (rooms[roomId].settings) {
          socket.emit("settings_updated", rooms[roomId].settings);
        }
        if (rooms[roomId].gameState) {
          socket.emit("game_started", rooms[roomId].gameState);
        }
      },
    );

    socket.on(
      "add_bot",
      ({
        roomId,
        team,
        role,
      }: {
        roomId: string;
        team: import("../../../shared/types").Team;
        role: import("../../../shared/types").Role;
      }) => {
        if (!rooms[roomId]) return;

        const botId = `bot_${Math.random().toString(36).substring(2, 9)}`;
        const newBot: Player = {
          id: botId,
          sessionId: botId,
          name: `AI ${role === "spymaster" ? "Spymaster" : "Operative"}`,
          team: team,
          role: role,
          connected: true,
          isBot: true,
          avatarBase64: `https://api.dicebear.com/7.x/bottts/svg?seed=${botId}`,
        };

        rooms[roomId].players.push(newBot);
        io.to(roomId).emit("room_update", getSafeRoom(rooms[roomId]));
      },
    );

    socket.on(
      "remove_bot",
      ({ roomId, botId }: { roomId: string; botId: string }) => {
        if (!rooms[roomId]) return;
        rooms[roomId].players = rooms[roomId].players.filter(
          (p) => p.id !== botId || !p.isBot,
        );
        io.to(roomId).emit("room_update", getSafeRoom(rooms[roomId]));
      },
    );

    socket.on("reset_teams", ({ roomId }: { roomId: string }) => {
      const room = rooms[roomId];
      if (room) {
        // Remove all bots on reset
        room.players = room.players.filter((p) => !p.isBot);
        room.players.forEach((p) => {
          p.team = "spectator";
          p.role = "spectator";
        });
        io.to(roomId).emit("room_update", getSafeRoom(room));
      }
    });

    socket.on(
      "update_settings",
      ({ roomId, settings }: { roomId: string; settings: any }) => {
        const room = rooms[roomId];
        if (room) {
          room.settings = settings;
          io.to(roomId).emit("settings_updated", settings);
        }
      },
    );

    socket.on("randomize_teams", ({ roomId }: { roomId: string }) => {
      const room = rooms[roomId];
      if (room) {
        const shuffled = shuffleArray([...room.players]);
        shuffled.forEach((p, i) => {
          if (i === 0) {
            p.team = "red";
            p.role = "spymaster";
          } else if (i === 1) {
            p.team = "blue";
            p.role = "spymaster";
          } else if (i % 2 === 0) {
            p.team = "red";
            p.role = "operative";
          } else {
            p.team = "blue";
            p.role = "operative";
          }
        });

        room.players.forEach((rp) => {
          const matched = shuffled.find((sp) => sp.id === rp.id);
          if (matched) {
            rp.team = matched.team;
            rp.role = matched.role;
          }
        });
        io.to(roomId).emit("room_update", getSafeRoom(room));
      }
    });

    socket.on(
      "start_game",
      ({
        roomId,
        language,
        gameMode,
        timerSettings,
        selectedPacks,
        customWords,
        customWordWeight,
        clueType,
        chaosMode,
        enabledModifiers,
      }: {
        roomId: string;
        language: Language;
        gameMode: GameMode;
        timerSettings: TimerSettings;
        selectedPacks: string[];
        customWords: string[];
        customWordWeight: CustomWordWeight;
        clueType: any;
        chaosMode?: boolean;
        enabledModifiers?: string[];
      }) => {
        const room = rooms[roomId];
        if (room) {
          const { cards, startingTeam } =
            gameMode === "duet"
              ? generateDuetGrid(
                  language,
                  selectedPacks,
                  customWords,
                  customWordWeight,
                )
              : generateGrid(
                  language,
                  selectedPacks,
                  customWords,
                  customWordWeight,
                );

          let initialTimeRemaining = 0;
          if (timerSettings.preset !== "off") {
            initialTimeRemaining =
              timerSettings.spymasterTime + timerSettings.extraFirstClueTime;
          }

          room.gameState = {
            gameMode,
            timerSettings,
            isFirstTurnOfGame: true,
            timeRemaining: initialTimeRemaining,
            timerTokens: gameMode === "duet" ? 9 : 0,
            isRTL: language === "ar",
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
            chaosMode: !!chaosMode,
            enabledModifiers: enabledModifiers || MODIFIERS.map((m) => m.id),
          };

          if (chaosMode) {
            applyRandomModifier(room);
          }

          startTimer(io, room);

          io.to(roomId).emit("game_started", room.gameState);
          io.to(roomId).emit("room_update", getSafeRoom(room));

          // Trigger Spymaster Bot on game start if applicable
          if (room.gameState.currentPhase === "spymaster") {
            const spymasterBots = room.players.filter(
              (p) =>
                p.team === room.gameState!.currentTurn &&
                p.role === "spymaster" &&
                p.isBot,
            );
            if (spymasterBots.length > 0) {
              setTimeout(
                () => triggerBotSpymaster(io, room, spymasterBots[0]),
                getBotDelayMs(room) + 1000,
              );
            }
          }
        }
      },
    );

    socket.on(
      "submit_cue",
      ({
        roomId,
        cue,
        number,
        targets,
      }: {
        roomId: string;
        cue: string;
        number: number;
        targets?: number[];
      }) => {
        const room = rooms[roomId];
        const player = room?.players.find((p) => p.id === socket.id);

        console.log("SUBMIT CUE EVENT:", {
          roomId,
          cue,
          number,
          targets,
          activeModifier: room?.gameState?.activeModifier,
        });

        if (room && room.gameState && !room.gameState.winner && player) {
          const isDuet = room.gameState.gameMode === "duet";

          if (
            room.gameState.currentPhase === "spymaster" &&
            player.team === room.gameState.currentTurn &&
            (player.role === "spymaster" || isDuet)
          ) {
            let finalCue = cue;
            if (room.gameState.activeModifier === "vowel-void") {
              finalCue = cue.replace(/[aeAE]/g, "");
              if (!finalCue) finalCue = "?";
            } else if (room.gameState.activeModifier === "oracle-riddle") {
              const words = cue.trim().split(/\s+/).filter(Boolean);
              if (
                words.length !== 2 ||
                !checkRhyme(words[0], words[1], !!room.gameState.isRTL)
              ) {
                return;
              }
              finalCue = words.join(" ");
            } else if (room.gameState.activeModifier === "boolean-search") {
              const matches = cue.match(/\s+(AND|OR|NOT)\s+/g);
              if (!matches || matches.length !== 1) {
                return;
              }
            } else if (room.gameState.activeModifier === "forced-acronym") {
              const letters =
                room.gameState.modifierState?.acronym?.split("-") || [];
              const words = cue.trim().split(/\s+/).filter(Boolean);
              if (words.length !== letters.length) return;
              for (let i = 0; i < letters.length; i++) {
                if (words[i][0].toLowerCase() !== letters[i].toLowerCase()) {
                  return;
                }
              }
            }

            let finalNumber = number;
            if (room.gameState.activeModifier === "the-dictator") {
              if (room.gameState.modifierState?.forcedNumber !== undefined) {
                finalNumber = room.gameState.modifierState.forcedNumber;
              }
            } else if (room.gameState.activeModifier === "off-by-one") {
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
            room.gameState.currentPhase = "operative";
            room.gameState.successfulGuessesThisTurn = 0;
            room.gameState.isFirstTurnOfGame = false;
            room.gameState.highlightedCards = {};

            room.gameState.gameLog.push({
              id: Math.random().toString(36).substring(7),
              type: "cue",
              player: {
                name: player.name,
                avatarUrl: getPlayerAvatarUrl(player),
              },
              team: player.team as "red" | "blue",
              cueWord: finalCue,
              cueNumber: finalNumber,
              targets: targets,
              timestamp: Date.now(),
            });

            if (
              room.gameState.activeModifier === "the-intercept" &&
              room.gameState.gameMode === "classic"
            ) {
              if (!room.gameState.modifierState)
                room.gameState.modifierState = {};
              room.gameState.modifierState.interceptPhase = true;
              room.gameState.modifierState.interceptTimeLeft = 5;

              const interceptInterval = setInterval(() => {
                if (
                  !room.gameState ||
                  room.gameState.modifierState?.interceptPhase !== true
                ) {
                  clearInterval(interceptInterval);
                  return;
                }
                room.gameState.modifierState.interceptTimeLeft--;
                if (room.gameState.modifierState.interceptTimeLeft <= 0) {
                  room.gameState.modifierState.interceptPhase = false;
                  room.gameState.modifierState.interceptTimeLeft = 0;
                  clearInterval(interceptInterval);
                  startTimer(io, room);

                  // Trigger Operative bots for the active team if applicable
                  const operativeBots = room.players.filter(
                    (p) =>
                      p.team === room.gameState!.currentTurn &&
                      p.role === "operative" &&
                      p.isBot,
                  );
                  if (operativeBots.length > 0) {
                    setTimeout(
                      () =>
                        triggerBotOperatives(
                          io,
                          room,
                          room.gameState!.activeCue || "",
                          room.gameState!.activeCueNumber || 1,
                          operativeBots[0],
                        ),
                      getBotDelayMs(room),
                    );
                  }
                }
                io.to(roomId).emit("game_update", room.gameState);
              }, 1000);

              io.to(roomId).emit("game_update", room.gameState);
              return;
            }

            startTimer(io, room);
            io.to(roomId).emit("game_update", room.gameState);

            // Trigger Operative bots if applicable
            if (
              room.gameState.activeModifier !== "the-intercept" ||
              room.gameState.gameMode !== "classic"
            ) {
              const operativeBots = room.players.filter(
                (p) =>
                  p.team === room.gameState!.currentTurn &&
                  p.role === "operative" &&
                  p.isBot,
              );
              if (operativeBots.length > 0) {
                setTimeout(
                  () =>
                    triggerBotOperatives(
                      io,
                      room,
                      finalCue,
                      finalNumber,
                      operativeBots[0],
                    ),
                  getBotDelayMs(room),
                );
              }
            }
          }
        }
      },
    );

    socket.on(
      "highlight_card",
      ({ roomId, cardId }: { roomId: string; cardId: number | null }) => {
        const room = rooms[roomId];
        const player = room?.players.find((p) => p.id === socket.id);

        if (room && room.gameState && !room.gameState.winner && player) {
          if (room.gameState.currentPhase !== "operative") return;

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
          io.to(roomId).emit("game_update", room.gameState);
        }
      },
    );

    socket.on(
      "guess_card",
      ({ roomId, cardId }: { roomId: string; cardId: number }) => {
        const room = rooms[roomId];
        const player = room?.players.find((p) => p.id === socket.id);
        if (room && player) {
          processGuess(io, room, player, cardId);
        }
      },
    );

    socket.on("end_turn", ({ roomId }: { roomId: string }) => {
      const room = rooms[roomId];
      const player = room?.players.find((p) => p.id === socket.id);

      if (room && room.gameState && !room.gameState.winner && player) {
        const isDuet = room.gameState.gameMode === "duet";
        const expectedGuessTeam = isDuet
          ? room.gameState.currentTurn === "red"
            ? "blue"
            : "red"
          : room.gameState.currentTurn;

        if (
          room.gameState.currentPhase === "operative" &&
          player.team === expectedGuessTeam &&
          (player.role === "operative" || isDuet)
        ) {
          room.gameState.gameLog.push({
            id: Math.random().toString(36).substring(7),
            type: "guess",
            player: {
              name: player.name,
              avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=${player.team === "red" ? "ef4444" : "3b82f6"}`,
            },
            guessingTeam: player.team as "red" | "blue",
            cardWord: "Ended Turn",
            revealedColor: "neutral",
            timestamp: Date.now(),
          });

          transitionToNewTurn(io, room);
          io.to(roomId).emit("game_update", room.gameState);
        }
      }
    });

    socket.on("reject_clue", ({ roomId }: { roomId: string }) => {
      const room = rooms[roomId];
      const player = room?.players.find((p) => p.id === socket.id);

      if (room && room.gameState && !room.gameState.winner && player) {
        if (room.gameState.currentPhase !== "operative") return;
        if (room.gameState.activeModifier !== "mutiny") return;
        if (room.gameState.modifierState?.mutinyUsed) return;

        const isDuet = room.gameState.gameMode === "duet";
        const expectedGuessTeam = isDuet
          ? room.gameState.currentTurn === "red"
            ? "blue"
            : "red"
          : room.gameState.currentTurn;

        if (
          player.team !== expectedGuessTeam ||
          (!isDuet && player.role !== "operative")
        )
          return;

        if (!room.gameState.modifierState) room.gameState.modifierState = {};
        room.gameState.modifierState.mutinyUsed = true;

        room.gameState.currentPhase = "spymaster";
        room.gameState.activeCue = null;
        room.gameState.activeCueNumber = null;
        room.gameState.successfulGuessesThisTurn = 0;

        room.gameState.gameLog.push({
          id: Math.random().toString(36).substring(7),
          type: "guess",
          player: {
            name: player.name,
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=${player.team === "red" ? "ef4444" : "3b82f6"}`,
          },
          guessingTeam: player.team as "red" | "blue",
          cardWord: "Rejected the Clue! (Mutiny)",
          revealedColor: "neutral",
          timestamp: Date.now(),
        });

        startTimer(io, room);
        io.to(roomId).emit("game_update", room.gameState);
      }
    });

    socket.on(
      "intercept_guess",
      ({ roomId, cardId }: { roomId: string; cardId: number }) => {
        const room = rooms[roomId];
        const player = room?.players.find((p) => p.id === socket.id);

        if (room && room.gameState && !room.gameState.winner && player) {
          if (room.gameState.currentPhase !== "operative") return;
          if (room.gameState.activeModifier !== "the-intercept") return;
          if (!room.gameState.modifierState?.interceptPhase) return;

          const isDuet = room.gameState.gameMode === "duet";
          if (isDuet) return;

          const activeTeam = room.gameState.currentTurn;
          const enemyTeam = activeTeam === "red" ? "blue" : "red";

          if (player.team !== enemyTeam || player.role !== "operative") return;

          const card = room.gameState.cards.find((c) => c.id === cardId);
          if (!card || card.revealed) return;

          // End the intercept phase regardless of outcome
          room.gameState.modifierState.interceptPhase = false;
          room.gameState.modifierState.interceptTimeLeft = 0;

          const isHit = card.type === activeTeam;

          if (isHit) {
            // ✅ HIT — reveal the card (active team keeps the point), skip active team's turn
            card.revealed = true;

            if (activeTeam === "red") {
              room.gameState.redScore--;
              if (room.gameState.redScore <= 0) room.gameState.winner = "red";
            } else {
              room.gameState.blueScore--;
              if (room.gameState.blueScore <= 0) room.gameState.winner = "blue";
            }

            room.gameState.gameLog.push({
              id: Math.random().toString(36).substring(7),
              type: "guess",
              player: {
                name: `${player.name} (Intercept)`,
                avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=${player.team === "red" ? "ef4444" : "3b82f6"}`,
              },
              guessingTeam: enemyTeam,
              cardWord: getLoggedWord(room, card),
              revealedColor: card.type,
              timestamp: Date.now(),
            });

            if (!room.gameState.winner) {
              room.gameState.gameLog.push({
                id: Math.random().toString(36).substring(7),
                type: "guess",
                player: {
                  name: "⚡ The Intercept",
                  avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=intercept&backgroundColor=7c3aed`,
                },
                guessingTeam: enemyTeam,
                cardWord: `${enemyTeam === "red" ? "🔴 Red" : "🔵 Blue"} team's shot landed! ${activeTeam === "red" ? "🔴 Red" : "🔵 Blue"} team's turn has been skipped!`,
                revealedColor: "neutral",
                timestamp: Date.now(),
              });

              // Skip active team's turn — go straight to enemy (intercepting) team
              transitionToNewTurn(io, room);
              io.to(roomId).emit("game_update", room.gameState);
            } else {
              io.to(roomId).emit("game_update", room.gameState);
            }
          } else {
            // ❌ MISS — don't reveal the card, apply penalty to enemy team's next turn
            if (!room.gameState.modifierState)
              room.gameState.modifierState = {};
            room.gameState.modifierState.interceptPenalty = enemyTeam;

            room.gameState.gameLog.push({
              id: Math.random().toString(36).substring(7),
              type: "guess",
              player: {
                name: `${player.name} (Intercept)`,
                avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=${player.team === "red" ? "ef4444" : "3b82f6"}`,
              },
              guessingTeam: enemyTeam,
              cardWord: `${enemyTeam === "red" ? "🔴 Red" : "🔵 Blue"} team missed! ${activeTeam === "red" ? "🔴 Red" : "🔵 Blue"} team continues...`,
              revealedColor: "neutral",
              timestamp: Date.now(),
            });

            // Active team resumes their turn
            startTimer(io, room);
            io.to(roomId).emit("game_update", room.gameState);

            // Trigger operative bots for the active team
            const operativeBots = room.players.filter(
              (p) =>
                p.team === room.gameState!.currentTurn &&
                p.role === "operative" &&
                p.isBot,
            );
            if (operativeBots.length > 0) {
              setTimeout(
                () =>
                  triggerBotOperatives(
                    io,
                    room,
                    room.gameState!.activeCue || "",
                    room.gameState!.activeCueNumber || 1,
                    operativeBots[0],
                  ),
                getBotDelayMs(room),
              );
            }
          }
        }
      },
    );

    socket.on(
      "use_blood_pact",
      ({ roomId, cardId }: { roomId: string; cardId: number }) => {
        const room = rooms[roomId];
        const player = room?.players.find((p) => p.id === socket.id);

        if (room && room.gameState && !room.gameState.winner && player) {
          if (room.gameState.currentPhase !== "operative") return;
          if (room.gameState.activeModifier !== "blood-pact") return;
          if (room.gameState.modifierState?.bloodPactStatus !== "available")
            return;
          if (room.gameState.successfulGuessesThisTurn > 0) return;

          const isDuet = room.gameState.gameMode === "duet";
          const expectedGuessTeam = isDuet
            ? room.gameState.currentTurn === "red"
              ? "blue"
              : "red"
            : room.gameState.currentTurn;

          if (
            player.team !== expectedGuessTeam ||
            (!isDuet && player.role !== "operative")
          )
            return;

          const card = room.gameState.cards.find((c) => c.id === cardId);
          if (!card) return;

          if (isDuet) {
            const alreadyRevealed =
              expectedGuessTeam === "blue"
                ? card.revealedByB
                : card.revealedByA;
            if (alreadyRevealed) return;

            if (expectedGuessTeam === "blue") card.revealedByB = true;
            else card.revealedByA = true;

            const keyType =
              expectedGuessTeam === "blue" ? card.duetTypeA : card.duetTypeB;

            if (
              keyType === "green" ||
              keyType === "assassin" ||
              (card.revealedByA && card.revealedByB)
            ) {
              card.revealed = true;
              card.type = keyType!;
            }

            room.gameState.gameLog.push({
              id: Math.random().toString(36).substring(7),
              type: "guess",
              player: {
                name: `${player.name} (Blood Pact)`,
                avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=882222`,
              },
              guessingTeam: expectedGuessTeam as "red" | "blue",
              cardWord: getLoggedWord(room, card),
              revealedColor: keyType!,
              timestamp: Date.now(),
            });
          } else {
            if (card.revealed) return;
            card.revealed = true;

            room.gameState.gameLog.push({
              id: Math.random().toString(36).substring(7),
              type: "guess",
              player: {
                name: `${player.name} (Blood Pact)`,
                avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=882222`,
              },
              guessingTeam: expectedGuessTeam as "red" | "blue",
              cardWord: getLoggedWord(room, card),
              revealedColor: card.type,
              timestamp: Date.now(),
            });
          }

          if (!isDuet) {
            if (card.type === "red") {
              room.gameState.redScore--;
              if (room.gameState.redScore === 0) room.gameState.winner = "red";
            } else if (card.type === "blue") {
              room.gameState.blueScore--;
              if (room.gameState.blueScore === 0)
                room.gameState.winner = "blue";
            }
          } else {
            let foundGreens = 0;
            room.gameState.cards.forEach((c) => {
              if (c.duetTypeA === "green" && c.revealedByB) foundGreens++;
              if (c.duetTypeB === "green" && c.revealedByA) foundGreens++;
            });
            if (foundGreens >= 15) {
              room.gameState.winner = "red";
            }
          }

          if (room.gameState.highlightedCards) {
            for (const playerId of Object.keys(
              room.gameState.highlightedCards,
            )) {
              room.gameState.highlightedCards[playerId] =
                room.gameState.highlightedCards[playerId].filter(
                  (cId) => cId !== cardId,
                );
            }
          }

          room.gameState.modifierState.bloodPactStatus = "used";
          room.gameState.modifierState.bloodPactOneGuessLeft = true;

          io.to(roomId).emit("game_update", room.gameState);
        }
      },
    );

    socket.on("d20_roll", ({ roomId }: { roomId: string }) => {
      const room = rooms[roomId];
      const player = room?.players.find((p) => p.id === socket.id);

      if (room && room.gameState && !room.gameState.winner && player) {
        if (room.gameState.currentPhase !== "spymaster") return;
        if (room.gameState.activeModifier !== "d20-roll") return;
        if (room.gameState.modifierState?.rolled) return;

        const isDuet = room.gameState.gameMode === "duet";
        const expectedTurn = room.gameState.currentTurn;
        if (
          player.team !== expectedTurn ||
          (!isDuet && player.role !== "spymaster")
        )
          return;

        if (!room.gameState.modifierState) room.gameState.modifierState = {};

        const result: number = Math.floor(Math.random() * 20) + 1;
        room.gameState.modifierState.rolled = true;
        room.gameState.modifierState.result = result;

        room.gameState.gameLog.push({
          id: Math.random().toString(36).substring(7),
          type: "guess",
          player: {
            name: `${player.name} (D20)`,
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=e67e22`,
          },
          guessingTeam: expectedTurn as "red" | "blue",
          cardWord: `Rolled a ${result}!`,
          revealedColor: "neutral",
          timestamp: Date.now(),
        });

        io.to(roomId).emit("game_update", room.gameState);

        setTimeout(() => {
          const currentRoom = rooms[roomId];
          if (
            currentRoom &&
            currentRoom.gameState &&
            currentRoom.gameState.activeModifier === "d20-roll"
          ) {
            if (result === 1) {
              currentRoom.gameState.gameLog.push({
                id: Math.random().toString(36).substring(7),
                type: "guess",
                player: {
                  name: `System`,
                  avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=System&backgroundColor=e67e22`,
                },
                guessingTeam: expectedTurn as "red" | "blue",
                cardWord: `Critical Failure! Turn skipped.`,
                revealedColor: "assassin",
                timestamp: Date.now(),
              });
              transitionToNewTurn(io, currentRoom);
              io.to(roomId).emit("game_update", currentRoom.gameState);
            } else if (result === 20) {
              currentRoom.gameState.modifierState.rollCompleted = true;
              currentRoom.gameState.modifierState.canRevealForFree = true;
              io.to(roomId).emit("game_update", currentRoom.gameState);
            } else {
              currentRoom.gameState.modifierState.rollCompleted = true;
              io.to(roomId).emit("game_update", currentRoom.gameState);
            }
          }
        }, 3500);
      }
    });

    socket.on(
      "d20_free_reveal",
      ({ roomId, cardId }: { roomId: string; cardId: number }) => {
        const room = rooms[roomId];
        const player = room?.players.find((p) => p.id === socket.id);

        if (room && room.gameState && !room.gameState.winner && player) {
          if (room.gameState.currentPhase !== "spymaster") return;
          if (room.gameState.activeModifier !== "d20-roll") return;
          if (!room.gameState.modifierState?.canRevealForFree) return;

          const isDuet = room.gameState.gameMode === "duet";
          const expectedTurn = room.gameState.currentTurn;
          if (
            player.team !== expectedTurn ||
            (!isDuet && player.role !== "spymaster")
          )
            return;

          const card = room.gameState.cards.find((c) => c.id === cardId);
          if (!card) return;

          // In duet: when currentTurn="red", the guessing team is "blue"
          // so we check/set revealedByB and use duetTypeA (red's key)
          const isUnrevealed = isDuet
            ? expectedTurn === "red"
              ? !card.revealedByB
              : !card.revealedByA
            : !card.revealed;

          if (!isUnrevealed) return;

          const teamColor = expectedTurn;
          const validColor = isDuet
            ? (expectedTurn === "red" ? card.duetTypeA : card.duetTypeB) ===
              "green"
            : card.type === teamColor;

          if (!validColor) return;

          // Clear the free reveal flag
          delete room.gameState.modifierState.canRevealForFree;

          // Directly reveal the card (processGuess can't be used here since phase is "spymaster")
          if (isDuet) {
            // Match processGuess mapping: red turn → blue guesses → revealedByB
            if (expectedTurn === "red") card.revealedByB = true;
            else card.revealedByA = true;
            // Use the spymaster's (clue-giver's) key for the card type
            const keyType = expectedTurn === "red" ? card.duetTypeA : card.duetTypeB;
            if (keyType === "green" || (card.revealedByA && card.revealedByB)) {
              card.revealed = true;
              card.type = keyType!;
            }
          } else {
            card.revealed = true;
          }

          room.gameState.gameLog.push({
            id: Math.random().toString(36).substring(7),
            type: "guess",
            player: {
              name: `${player.name} (Critical Success)`,
              avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=10b981`,
            },
            guessingTeam: expectedTurn as "red" | "blue",
            cardWord: `Revealed ${getLoggedWord(room, card)} for free!`,
            revealedColor: card.type as any,
            timestamp: Date.now(),
          });

          // Check for win condition after reveal
          if (isDuet) {
            const allGreenRevealedByA = room.gameState.cards
              .filter((c) => c.duetTypeA === "green")
              .every((c) => c.revealedByB);
            const allGreenRevealedByB = room.gameState.cards
              .filter((c) => c.duetTypeB === "green")
              .every((c) => c.revealedByA);
            if (allGreenRevealedByA && allGreenRevealedByB) {
              room.gameState.winner = "green" as any;
            }
          } else {
            const teamCards = room.gameState.cards.filter(
              (c) => c.type === teamColor
            );
            if (teamCards.every((c) => c.revealed)) {
              room.gameState.winner = teamColor;
            }
          }

          // Stay in spymaster phase so they can give a normal clue
          io.to(roomId).emit("game_update", room.gameState);
        }
      },
    );

    socket.on("gacha_pull", ({ roomId }: { roomId: string }) => {
      const room = rooms[roomId];
      const player = room?.players.find((p) => p.id === socket.id);

      if (room && room.gameState && !room.gameState.winner && player) {
        if (room.gameState.currentPhase !== "operative") return;
        if (room.gameState.activeModifier !== "gacha-pull") return;
        if (room.gameState.modifierState?.gachaPulling) return;

        const isDuet = room.gameState.gameMode === "duet";
        const expectedGuessTeam = isDuet
          ? room.gameState.currentTurn === "red"
            ? "blue"
            : "red"
          : room.gameState.currentTurn;

        if (
          player.team !== expectedGuessTeam ||
          (!isDuet && player.role !== "operative")
        )
          return;

        const unrevealedCards = room.gameState.cards.filter((c) => {
          if (isDuet) {
            return expectedGuessTeam === "blue"
              ? !c.revealedByB
              : !c.revealedByA;
          } else {
            return !c.revealed;
          }
        });

        if (unrevealedCards.length > 0) {
          // Set pulling state to lock UI
          if (!room.gameState.modifierState) room.gameState.modifierState = {};
          const chances = room.gameState.modifierState.gachaChances;
          const chanceSnapshot = chances
            ? { ...chances }
            : generateGachaChances(room.gameState);
          room.gameState.modifierState.gachaPulling = true;
          room.gameState.modifierState.gachaChances = chanceSnapshot;
          io.to(roomId).emit("game_update", {
            ...room.gameState,
            modifierState: {
              ...(room.gameState.modifierState || {}),
              gachaPulling: true,
              gachaChances: chanceSnapshot,
            },
          });

          let selectedType: string | null = null;
          if (chanceSnapshot) {
            const roll = Math.random() * 100;
            let acc = 0;
            if (roll < (acc += chanceSnapshot.correct))
              selectedType = "correct";
            else if (roll < (acc += chanceSnapshot.assassin))
              selectedType = "assassin";
            else if (roll < (acc += chanceSnapshot.enemy))
              selectedType = "enemy";
            else selectedType = "neutral";
          }

          const validCardsForType = unrevealedCards.filter((c) => {
            if (!selectedType) return true;
            if (isDuet) {
              const type =
                expectedGuessTeam === "blue" ? c.duetTypeA : c.duetTypeB;
              if (selectedType === "correct") return type === "green";
              if (selectedType === "assassin") return type === "assassin";
              if (selectedType === "neutral") return type === "neutral";
              return false;
            } else {
              if (selectedType === "correct")
                return c.type === expectedGuessTeam;
              if (selectedType === "assassin") return c.type === "assassin";
              if (selectedType === "neutral") return c.type === "neutral";
              if (selectedType === "enemy")
                return (
                  c.type !== expectedGuessTeam &&
                  c.type !== "neutral" &&
                  c.type !== "assassin"
                );
              return false;
            }
          });

          let randomCard;
          if (validCardsForType.length > 0) {
            randomCard =
              validCardsForType[
                Math.floor(Math.random() * validCardsForType.length)
              ];
          } else {
            randomCard =
              unrevealedCards[
                Math.floor(Math.random() * unrevealedCards.length)
              ];
          }

          const candidateIds = unrevealedCards.map((c) => c.id);

          // Build a pre-computed random highlight sequence so all clients show the exact same random picks
          const highlightSequence: number[] = [];
          const steps = 20;
          for (let i = 0; i < steps; i++) {
            highlightSequence.push(
              candidateIds[Math.floor(Math.random() * candidateIds.length)],
            );
          }

          // Emit the animation start to all clients
          io.to(roomId).emit("gacha_start_animation", {
            highlightSequence,
            targetCardId: randomCard.id,
          });

          setTimeout(() => {
            const currentRoom = rooms[roomId];
            if (currentRoom && currentRoom.gameState) {
              if (currentRoom.gameState.modifierState) {
                delete currentRoom.gameState.modifierState.gachaPulling;
              }

              if (!currentRoom.gameState.winner) {
                // Verify card is still unrevealed
                const stillUnrevealed = isDuet
                  ? expectedGuessTeam === "blue"
                    ? !randomCard.revealedByB
                    : !randomCard.revealedByA
                  : !randomCard.revealed;

                if (stillUnrevealed) {
                  currentRoom.gameState.gameLog.push({
                    id: Math.random().toString(36).substring(7),
                    type: "guess",
                    player: {
                      name: `${player.name} (Lever Pull)`,
                      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=e67e22`,
                    },
                    guessingTeam: expectedGuessTeam as "red" | "blue",
                    cardWord: "Pulled the Gacha Lever!",
                    revealedColor: "neutral",
                    timestamp: Date.now(),
                  });

                  processGuess(io, currentRoom, player, randomCard.id);

                  if (!currentRoom.gameState.winner) {
                    currentRoom.gameState.modifierState =
                      currentRoom.gameState.modifierState || {};
                    currentRoom.gameState.modifierState.gachaChances =
                      generateGachaChances(currentRoom.gameState);
                    io.to(roomId).emit("game_update", currentRoom.gameState);
                  }
                } else {
                  // Fallback emit if card was somehow revealed
                  io.to(roomId).emit("game_update", currentRoom.gameState);
                }
              }
            }
          }, 3800);
        }
      }
    });

    socket.on(
      "lock_card",
      ({ roomId, cardId }: { roomId: string; cardId: number }) => {
        const room = rooms[roomId];
        const player = room?.players.find((p) => p.id === socket.id);

        if (room && room.gameState && !room.gameState.winner && player) {
          if (room.gameState.currentPhase !== "operative") return;
          if (room.gameState.activeModifier !== "shield-wall") return;
          if (!room.gameState.modifierState?.shieldActive) return;

          const isDuet = room.gameState.gameMode === "duet";
          const expectedGuessTeam = isDuet
            ? room.gameState.currentTurn === "red"
              ? "blue"
              : "red"
            : room.gameState.currentTurn;

          if (
            player.team !== expectedGuessTeam ||
            (!isDuet && player.role !== "operative")
          )
            return;

          const card = room.gameState.cards.find((c) => c.id === cardId);
          if (card) {
            card.shieldedTurns = 2;

            room.gameState.gameLog.push({
              id: Math.random().toString(36).substring(7),
              type: "guess",
              player: {
                name: player.name,
                avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=64748b`,
              },
              guessingTeam: expectedGuessTeam as "red" | "blue",
              cardWord: `Locked card: ${getLoggedWord(room, card)}`,
              revealedColor: "neutral",
              timestamp: Date.now(),
            });

            room.gameState.modifierState.shieldActive = false;

            io.to(roomId).emit("game_update", room.gameState);
          }
        }
      },
    );

    socket.on(
      "prank_vibrate",
      ({
        roomId,
        targetPlayerId,
      }: {
        roomId: string;
        targetPlayerId: string;
      }) => {
        const room = rooms[roomId];
        if (
          room &&
          room.players.length > 0 &&
          room.players[0].id === socket.id
        ) {
          io.to(roomId).emit("trigger_prank", { targetPlayerId });
        }
      },
    );

    socket.on("play_again", ({ roomId }: { roomId: string }) => {
      const room = rooms[roomId];
      if (room && room.players.length > 0 && room.players[0].id === socket.id) {
        // Mark the room as transitioning back to lobby so that
        // temporary disconnects (clients navigating from game → lobby)
        // don't remove players or delete the room.
        room.returningToLobby = true;
        room.gameState = null;
        io.to(roomId).emit("return_to_lobby");
        io.to(roomId).emit("room_update", getSafeRoom(room));

        // Clear the flag after 15s – enough time for all clients to reconnect
        setTimeout(() => {
          if (rooms[roomId]) {
            rooms[roomId].returningToLobby = false;
          }
        }, 15000);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
      for (const roomId in rooms) {
        const room = rooms[roomId];
        const playerIndex = room.players.findIndex((p) => p.id === socket.id);
        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          
          if (!room.gameState && !room.returningToLobby) {
            // Normal lobby disconnect – remove player entirely
            room.players.splice(playerIndex, 1);
          } else {
            // During a game or lobby-return transition – keep player, mark offline
            player.connected = false;
          }
          
          io.to(roomId).emit("room_update", getSafeRoom(room));

          const isHost = (player.sessionId && player.sessionId === room.hostSessionId) || (player.id === room.hostSessionId);
          if (isHost && !room.returningToLobby) {
            console.log(
              `Host ${player.name} disconnected from room ${roomId}. Scheduling room deletion with 5s grace period.`,
            );
            if (room.deletionTimeout) {
              clearTimeout(room.deletionTimeout);
            }
            room.deletionTimeout = setTimeout(() => {
              console.log(`Host deletion grace period expired. Deleting room ${roomId}.`);
              stopTimer(room);
              io.to(roomId).emit("host_disconnected");
              delete rooms[roomId];
            }, 5000);
          } else if (isHost && room.returningToLobby) {
            console.log(
              `Host ${player.name} disconnected during lobby transition for room ${roomId}. Skipping deletion – expecting reconnect.`,
            );
          }
        }
      }
    });
  });
}
