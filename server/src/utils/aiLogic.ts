import * as fs from "fs";
import * as path from "path";
import { wordPackRegistry } from "../../../shared/wordPacks";
import { checkRhyme } from "../../../shared/modifiers";

let embeddings: Record<string, number[]> = {};

export function loadEmbeddings() {
  try {
    const embeddingsPath = path.join(__dirname, "../../assets/embeddings.json");
    if (fs.existsSync(embeddingsPath)) {
      const data = fs.readFileSync(embeddingsPath, "utf8");
      embeddings = JSON.parse(data);
      console.log(
        `Loaded embeddings for ${Object.keys(embeddings).length} words.`,
      );
    } else {
      console.warn(
        "Embeddings file not found! AI Bots will not work properly until you run npm run download-embeddings",
      );
    }
  } catch (err) {
    console.error("Failed to load embeddings:", err);
  }
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return -1;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Function to map Arabic words to English counterparts if playing in Arabic
export function getEnglishEquivalent(word: string, language: string): string {
  if (language === "en") return word.toLowerCase();

  for (const packName in wordPackRegistry[language]) {
    const idx = wordPackRegistry[language][packName].indexOf(word);
    if (
      idx !== -1 &&
      wordPackRegistry["en"] &&
      wordPackRegistry["en"][packName] &&
      wordPackRegistry["en"][packName][idx]
    ) {
      return wordPackRegistry["en"][packName][idx].toLowerCase();
    }
  }
  // Fallback if it's a custom word or not found
  return word.toLowerCase();
}

export function getWordVector(word: string, language: string): number[] | null {
  const englishWord = getEnglishEquivalent(word, language);
  return embeddings[englishWord] || null;
}

export function getAllDictionaryWords(): string[] {
  return Object.keys(embeddings);
}

function applyModifierRules(
  clueWord: string,
  clueCount: number,
  activeModifier: string | null,
  modifierState: any,
  candidateWords: string[],
): { word: string; count: number } | null {
  let nextWord = clueWord.trim();
  let nextCount = clueCount;

  if (activeModifier === "the-dictator") {
    if (modifierState?.forcedNumber !== undefined) {
      nextCount = modifierState.forcedNumber;
    }
  }

  if (activeModifier === "off-by-one") {
    if (nextCount === 99) {
      nextCount = 99;
    } else {
      const offset = Math.random() < 0.5 ? -1 : 1;
      nextCount = Math.max(0, Math.min(9, nextCount + offset));
    }
  }

  if (activeModifier === "vowel-void") {
    nextWord = nextWord.replace(/[aeiou]/gi, "");
  }

  if (activeModifier === "five-letter-curse") {
    const exactLengthWord = candidateWords.find(
      (word) => word.length === 5 && !nextWord.toLowerCase().includes(word),
    );
    if (exactLengthWord) {
      nextWord = exactLengthWord;
    } else {
      const trimmed = nextWord.replace(/\s+/g, "").slice(0, 5);
      nextWord = trimmed || "thing";
    }
  }

  if (activeModifier === "boolean-search") {
    const operator = ["AND", "OR", "NOT"][Math.floor(Math.random() * 3)];
    const fallbackWord =
      candidateWords.find((word) => word !== nextWord.toLowerCase()) || "thing";
    nextWord = `${nextWord} ${operator} ${fallbackWord}`;
  }

  if (activeModifier === "forced-acronym") {
    const letters = (modifierState?.acronym || "")
      .split("-")
      .map((part: string) => part.toLowerCase())
      .filter(Boolean);

    if (letters.length > 0) {
      const phraseWords = letters
        .map((letter: string) =>
          candidateWords.find(
            (word) =>
              word.startsWith(letter) &&
              !word.toLowerCase().includes(nextWord.toLowerCase()),
          ),
        )
        .filter(Boolean) as string[];

      if (phraseWords.length === letters.length) {
        nextWord = phraseWords.join(" ");
      }
    }
  }

  if (!nextWord || nextWord.trim().length === 0) {
    return null;
  }

  return { word: nextWord, count: nextCount };
}

/**
 * NEW ALGORITHM: Safety-First, Strict Threshold Spymaster Clue Generation
 * 
 * Core principle: Build clues that connect to multiple friendly words ONLY if all
 * connections exceed high similarity thresholds. Heavily penalize danger associations.
 * Try target counts from 4 down to 1, always preferring safer, smaller clues.
 */
export function getBotSpymasterClue(
  cards: import("../../../shared/types").Card[],
  team: import("../../../shared/types").Team,
  language: string,
  isDuet: boolean,
  activeModifier: string | null = null,
  modifierState: any = null,
): { word: string; count: number } | null {
  // === PHASE 1: CATEGORIZE BOARD ===
  const unrevealedCards = cards.filter((c) => {
    if (isDuet) {
      return team === "red" ? !c.revealedByB : !c.revealedByA;
    }
    return !c.revealed;
  });

  const friendlyCards: typeof cards = [];
  const neutralCards: typeof cards = [];
  const assassinCards: typeof cards = [];
  const enemyCards: typeof cards = [];

  unrevealedCards.forEach((c) => {
    let type = c.type;
    if (isDuet) {
      type = team === "red" ? c.duetTypeA! : c.duetTypeB!;
    }

    if (isDuet) {
      if (type === "green") friendlyCards.push(c);
      else if (type === "assassin") assassinCards.push(c);
      else if (type === "neutral") neutralCards.push(c);
    } else {
      if (type === team) friendlyCards.push(c);
      else if (type === "neutral") neutralCards.push(c);
      else if (type === "assassin") assassinCards.push(c);
      else enemyCards.push(c);
    }
  });

  if (friendlyCards.length === 0) return null;

  // === PHASE 2: SANITY FILTERS ===
  const boardWords = new Set(
    cards.map((c) => getEnglishEquivalent(c.word, language).toLowerCase()),
  );

  const allDictWords = getAllDictionaryWords().filter(
    (w) =>
      !boardWords.has(w.toLowerCase()) &&
      w.length > 1 &&
      !w.includes(" "),
  );

  if (allDictWords.length === 0) return null;

  // === PHASE 3: DYNAMIC TARGET COUNT ===
  // Try to find clues for 4 targets, then 3, then 2, then 1
  const maxTargets = Math.min(friendlyCards.length, 4);

  for (let targetCount = maxTargets; targetCount >= 1; targetCount--) {
    // === PHASE 4: SELECT TARGET SUBSET ===
    // For each target count, pick the "best" subset to connect
    // (highest quality, most connectable words)
    const bestFriendlySubset = selectBestCardSubset(
      friendlyCards,
      language,
      targetCount,
    );

    // === PHASE 5: GENERATE CANDIDATE CLUES ===
    const candidates = generateRefinedCandidates(
      bestFriendlySubset,
      language,
      allDictWords,
    );

    // === PHASE 6: SCORE AND FIND BEST CLUE ===
    let bestScore = -Infinity;
    let bestCandidate: string | null = null;

    for (const candidateWord of candidates) {
      const score = scoreClueCandidate(
        candidateWord,
        bestFriendlySubset,
        neutralCards,
        enemyCards,
        assassinCards,
        language,
      );

      // Reject candidates with fatal flaws
      if (score === -Infinity) {
        continue;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidateWord;
      }
    }

    // If we found a valid clue for this target count, use it
    if (bestCandidate && bestScore > -10) {
      const finalClue = applyModifierRules(
        bestCandidate,
        targetCount,
        activeModifier,
        modifierState,
        allDictWords,
      );

      return finalClue;
    }
  }

  // No valid clue found even for single targets
  return null;
}

/**
 * Select the best N friendly cards to try to connect.
 * Heuristic: pick cards whose vectors are most "connectable" (high individual embedding quality).
 */
function selectBestCardSubset(
  friendlyCards: import("../../../shared/types").Card[],
  language: string,
  targetCount: number,
): import("../../../shared/types").Card[] {
  const withVectors = friendlyCards
    .map((card) => ({
      card,
      vec: getWordVector(card.word, language),
    }))
    .filter((item) => item.vec !== null) as Array<{
    card: import("../../../shared/types").Card;
    vec: number[];
  }>;

  if (withVectors.length === 0) return [];

  // Pick cards with strongest vectors (highest norm)
  withVectors.sort((a, b) => {
    const normA = Math.sqrt(a.vec.reduce((sum, v) => sum + v * v, 0));
    const normB = Math.sqrt(b.vec.reduce((sum, v) => sum + v * v, 0));
    return normB - normA;
  });

  return withVectors.slice(0, targetCount).map((item) => item.card);
}

/**
 * Generate a refined candidate clue set by finding words similar to the target subset.
 * Instead of scanning all dictionary, find words similar to the target words themselves.
 */
function generateRefinedCandidates(
  targetCards: import("../../../shared/types").Card[],
  language: string,
  allDictWords: string[],
): string[] {
  const allCandidates = new Set<string>();

  for (const targetCard of targetCards) {
    const targetVec = getWordVector(targetCard.word, language);
    if (!targetVec) continue;

    // Find words most similar to this target
    const similarWords = allDictWords
      .map((word) => {
        const wordVec = embeddings[word];
        if (!wordVec) return null;
        return {
          word,
          sim: cosineSimilarity(targetVec, wordVec),
        };
      })
      .filter((item): item is { word: string; sim: number } => !!item)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 50) // Top 50 similar to this target
      .map((item) => item.word);

    similarWords.forEach((w) => allCandidates.add(w));
  }

  return Array.from(allCandidates);
}

/**
 * Score a candidate clue against the target words and all danger categories.
 *
 * Scoring Logic:
 * - Raw Positive: ALL target words must exceed similarity 0.70 with the clue.
 *   baseScore = min(similarities to all targets)
 *   If baseScore < 0.70, return -Infinity (FATAL: not connected to all targets)
 * 
 * - Negative Penalties:
 *   1. Assassin: if similarity > 0.40, return -Infinity (FATAL: too close to assassin)
 *   2. Enemy: if similarity > 0.65, return -Infinity (FATAL: too close to opponent)
 *   3. Neutral: if similarity > 0.60, heavy penalty (-5.0 per occurrence)
 * 
 * - Final Score: baseScore - penalties
 */
function scoreClueCandidate(
  candidateWord: string,
  targetCards: import("../../../shared/types").Card[],
  neutralCards: import("../../../shared/types").Card[],
  enemyCards: import("../../../shared/types").Card[],
  assassinCards: import("../../../shared/types").Card[],
  language: string,
): number {
  const candidateVec = embeddings[candidateWord.toLowerCase()];
  if (!candidateVec) return -Infinity;

  // === POSITIVE: Must connect strongly to ALL target words ===
  const targetSimilarities = targetCards
    .map((card) => {
      const cardVec = getWordVector(card.word, language);
      if (!cardVec) return 0;
      return cosineSimilarity(candidateVec, cardVec);
    });

  const minTargetSim = Math.min(...targetSimilarities);

  // FATAL: If candidate doesn't connect to at least one target with high confidence
  if (minTargetSim < 0.70) {
    return -Infinity;
  }

  let baseScore = minTargetSim;

  // === NEGATIVE: Check assassin ===
  for (const assassin of assassinCards) {
    const assassinVec = getWordVector(assassin.word, language);
    if (!assassinVec) continue;

    const assassinSim = cosineSimilarity(candidateVec, assassinVec);
    // FATAL: Any meaningful connection to assassin is game-losing
    if (assassinSim > 0.40) {
      return -Infinity;
    }
  }

  // === NEGATIVE: Check enemy ===
  let enemyPenalty = 0;
  for (const enemy of enemyCards) {
    const enemyVec = getWordVector(enemy.word, language);
    if (!enemyVec) continue;

    const enemySim = cosineSimilarity(candidateVec, enemyVec);
    // FATAL: Strong connection to opponent is too risky
    if (enemySim > 0.65) {
      return -Infinity;
    }

    // Moderate penalty for weaker enemy connections
    if (enemySim > 0.50) {
      enemyPenalty += enemySim * 2.0;
    }
  }

  // === NEGATIVE: Check neutral ===
  let neutralPenalty = 0;
  for (const neutral of neutralCards) {
    const neutralVec = getWordVector(neutral.word, language);
    if (!neutralVec) continue;

    const neutralSim = cosineSimilarity(candidateVec, neutralVec);
    // Heavy penalty for neutral: it's a turn-ender
    if (neutralSim > 0.60) {
      neutralPenalty += 5.0;
    } else if (neutralSim > 0.50) {
      neutralPenalty += 2.0;
    }
  }

  const finalScore = baseScore - enemyPenalty - neutralPenalty;
  return finalScore;
}

export function rankCardsForOperative(
  clue: string,
  cards: import("../../../shared/types").Card[],
  team: import("../../../shared/types").Team,
  language: string,
  isDuet: boolean,
): import("../../../shared/types").Card[] {
  const clueVec = getWordVector(clue, language);

  const unrevealed = cards.filter((c) => {
    if (isDuet) return team === "red" ? !c.revealedByB : !c.revealedByA;
    return !c.revealed;
  });

  if (!clueVec) {
    return unrevealed.slice().sort((a, b) => a.word.localeCompare(b.word));
  }

  const scoredCards = unrevealed.map((c) => {
    const cardVec = getWordVector(c.word, language);
    let score = -1;
    if (cardVec) {
      score = cosineSimilarity(clueVec, cardVec);
    }
    return { card: c, score };
  });

  scoredCards.sort((a, b) => b.score - a.score);
  return scoredCards.map((sc) => sc.card);
}
