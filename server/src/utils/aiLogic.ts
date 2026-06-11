import * as dotenv from "dotenv";
dotenv.config(); // MUST be first — loads GROQ_API_KEY before Groq client initializes

import * as fs from "fs";
import * as path from "path";
import Groq from "groq-sdk";
import { wordPackRegistry } from "../../../shared/wordPacks";
import { checkRhyme } from "../../../shared/modifiers";

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

console.log(
  `[AI-INIT] GROQ_API_KEY present: ${!!process.env.GROQ_API_KEY}, Groq client ready: ${!!groq}`,
);

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
): { word: string; count: number; reasoning?: string } | null {
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
    (w) => !boardWords.has(w.toLowerCase()) && w.length > 1 && !w.includes(" "),
  );

  // Hardcoded safe fallback words when embeddings are not loaded
  const HARDCODED_FALLBACK_WORDS = [
    "animal",
    "vehicle",
    "nature",
    "ocean",
    "forest",
    "mountain",
    "weather",
    "color",
    "metal",
    "fabric",
    "planet",
    "season",
    "texture",
    "liquid",
    "energy",
    "journey",
    "signal",
    "origin",
    "pattern",
    "surface",
  ].filter((w) => !boardWords.has(w.toLowerCase()));

  if (allDictWords.length === 0 && HARDCODED_FALLBACK_WORDS.length > 0) {
    const word =
      HARDCODED_FALLBACK_WORDS[
        Math.floor(Math.random() * HARDCODED_FALLBACK_WORDS.length)
      ];
    return { word, count: 1 };
  }

  if (allDictWords.length === 0) {
    return { word: "nature", count: 1 };
  }

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
  // Fallback to avoid skipping turn: randomly select a dictionary word not on the board
  if (allDictWords.length > 0) {
    const randomWord =
      allDictWords[Math.floor(Math.random() * allDictWords.length)];
    const fallbackClue = applyModifierRules(
      randomWord,
      1,
      activeModifier,
      modifierState,
      allDictWords,
    );
    return fallbackClue
      ? {
          ...fallbackClue,
          reasoning: "Fallback random word (no strong connections found)",
        }
      : {
          word: randomWord,
          count: 1,
          reasoning: "Fallback random word (no strong connections found)",
        };
  }

  return {
    word: "skip",
    count: 0,
    reasoning: "No dictionary words available.",
  };
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
  const targetSimilarities = targetCards.map((card) => {
    const cardVec = getWordVector(card.word, language);
    if (!cardVec) return 0;
    return cosineSimilarity(candidateVec, cardVec);
  });

  const minTargetSim = Math.min(...targetSimilarities);

  // FATAL: If candidate doesn't connect to at least one target with high confidence
  if (minTargetSim < 0.7) {
    return -Infinity;
  }

  let baseScore = minTargetSim;

  // === NEGATIVE: Check assassin ===
  for (const assassin of assassinCards) {
    const assassinVec = getWordVector(assassin.word, language);
    if (!assassinVec) continue;

    const assassinSim = cosineSimilarity(candidateVec, assassinVec);
    // FATAL: Any meaningful connection to assassin is game-losing
    if (assassinSim > 0.4) {
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
    if (enemySim > 0.5) {
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
    if (neutralSim > 0.6) {
      neutralPenalty += 5.0;
    } else if (neutralSim > 0.5) {
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

function findBestCluster(
  friendlyCards: import("../../../shared/types").Card[],
  language: string
): { targetWords: string[]; targetCount: number } {
  const wordsWithVecs = friendlyCards
    .map((c) => ({
      word: c.word,
      vec: getWordVector(c.word, language)
    }))
    .filter((item) => item.vec !== null) as Array<{
    word: string;
    vec: number[];
  }>;

  if (wordsWithVecs.length === 0) {
    return { targetWords: [friendlyCards[0].word], targetCount: 1 };
  }

  if (wordsWithVecs.length === 1) {
    return { targetWords: [wordsWithVecs[0].word], targetCount: 1 };
  }

  if (wordsWithVecs.length === 2) {
    return { targetWords: [wordsWithVecs[0].word, wordsWithVecs[1].word], targetCount: 2 };
  }

  // Find best triplet
  let bestTriplet: string[] = [];
  let bestTripletSim = -Infinity;

  if (wordsWithVecs.length >= 3) {
    for (let i = 0; i < wordsWithVecs.length; i++) {
      for (let j = i + 1; j < wordsWithVecs.length; j++) {
        for (let k = j + 1; k < wordsWithVecs.length; k++) {
          const simAB = cosineSimilarity(wordsWithVecs[i].vec, wordsWithVecs[j].vec);
          const simBC = cosineSimilarity(wordsWithVecs[j].vec, wordsWithVecs[k].vec);
          const simAC = cosineSimilarity(wordsWithVecs[i].vec, wordsWithVecs[k].vec);
          const avgSim = (simAB + simBC + simAC) / 3;
          if (avgSim > bestTripletSim) {
            bestTripletSim = avgSim;
            bestTriplet = [wordsWithVecs[i].word, wordsWithVecs[j].word, wordsWithVecs[k].word];
          }
        }
      }
    }
  }

  // Find best pair
  let bestPair: string[] = [];
  let bestPairSim = -Infinity;
  for (let i = 0; i < wordsWithVecs.length; i++) {
    for (let j = i + 1; j < wordsWithVecs.length; j++) {
      const sim = cosineSimilarity(wordsWithVecs[i].vec, wordsWithVecs[j].vec);
      if (sim > bestPairSim) {
        bestPairSim = sim;
        bestPair = [wordsWithVecs[i].word, wordsWithVecs[j].word];
      }
    }
  }

  // If the best triplet is strong, use it
  if (bestTripletSim > 0.40 && bestTriplet.length === 3) {
    return { targetWords: bestTriplet, targetCount: 3 };
  }

  // Otherwise, if we have a pair, use it
  if (bestPairSim > 0.30 && bestPair.length === 2) {
    return { targetWords: bestPair, targetCount: 2 };
  }

  // Fallback: single best norm vector
  const sortedByNorm = [...wordsWithVecs].sort((a, b) => {
    const normA = Math.sqrt(a.vec.reduce((sum, v) => sum + v * v, 0));
    const normB = Math.sqrt(b.vec.reduce((sum, v) => sum + v * v, 0));
    return normB - normA;
  });

  return { targetWords: [sortedByNorm[0].word], targetCount: 1 };
}

export async function getLLMSpymasterClue(
  cards: import("../../../shared/types").Card[],
  team: import("../../../shared/types").Team,
  language: string,
  isDuet: boolean,
  activeModifier: string | null = null,
  modifierState: any = null,
): Promise<{ word: string; count: number; reasoning?: string } | null> {
  console.log(
    `[AI-SPY] getLLMSpymasterClue called. Team: ${team}, groqReady: ${!!groq}, modifier: ${activeModifier}`,
  );

  if (!groq) {
    console.warn(`[AI-SPY] No Groq client — falling back to local AI.`);
    return getBotSpymasterClue(
      cards,
      team,
      language,
      isDuet,
      activeModifier,
      modifierState,
    );
  }

  const unrevealedCards = cards.filter((c) => {
    if (isDuet) {
      return team === "red" ? !c.revealedByB : !c.revealedByA;
    }
    return !c.revealed;
  });

  const friendlyCards: import("../../../shared/types").Card[] = [];
  const enemyWords: string[] = [];
  const neutralWords: string[] = [];
  const assassinWords: string[] = [];

  unrevealedCards.forEach((c) => {
    let type = c.type;
    if (isDuet) {
      type = team === "red" ? c.duetTypeA! : c.duetTypeB!;
    }

    if (isDuet) {
      if (type === "green") friendlyCards.push(c);
      else if (type === "assassin") assassinWords.push(c.word);
      else if (type === "neutral") neutralWords.push(c.word);
    } else {
      if (type === team) friendlyCards.push(c);
      else if (type === "neutral") neutralWords.push(c.word);
      else if (type === "assassin") assassinWords.push(c.word);
      else enemyWords.push(c.word);
    }
  });

  if (friendlyCards.length === 0) return null;

  // Pre-cluster target words using cosine similarity of embeddings
  const { targetWords, targetCount } = findBestCluster(friendlyCards, language);

  const systemPrompt = `You are an expert Spymaster in the game Codenames.
Your goal is to provide a clue and a number that connects your team's target words without risking the assassin, neutral, or enemy words.
It cannot be any word currently visible on the board, nor contain any of the exact words on the board.

CRITICAL RULES FOR LOGIC:
1. STRICT POSITIVE FRAMEWORK: Find the lowest common hypernym (category) that encompasses the target words. Focus on actual shared properties, classifications, or direct common denominators (e.g. if target words are "ZOMBIE" and "DRACULA", the lowest common hypernym is "MONSTER" or "UNDEAD").
2. STRICT TARGET FOCUS: Your target words are strictly: [${targetWords.join(", ")}]. You MUST generate a clue that connects ONLY these ${targetCount} target words. Do not attempt to connect any other words on the board.
3. STRICT TRUTHFULNESS & COMMON SENSE: Connections must be universally acknowledged, direct, and obvious. Do NOT hallucinate false facts, geographical fallacies, or weak associative leaps.
4. NO STORYTELLING OR WEAK SCHEMAS: Do not create highly circumstantial scenarios to link words. If a connection is not something a normal player would immediately think of in 2 seconds, do NOT use it.
5. ABSOLUTE DANGER AVOIDANCE: Ensure the chosen clue has absolutely zero semantic overlap with the Assassin word, and minimal overlap with neutral or enemy words.

EXAMPLES OF ILLEGAL STORYTELLING (DO NOT DO THIS):
- Target Words: [PILLOW, SWORD, AFTERNOON]. Clue: "Knight". Reasoning: "A knight rests on a pillow, uses a sword, and quests in the afternoon." (REJECTED: Circumstantial narrative).
- Target Words: [TAVERN, OCEAN, VIDEO]. Clue: "Clear". Reasoning: "A tavern has clear drinks, oceans are clear water, video is clear resolution." (REJECTED: Weak, pun-based semantic stretch).

EXAMPLES OF LEGAL CONNECTIONS:
- Target Words: [OCEAN, RIVER, PUDDLE]. Clue: "Water". Reasoning: "All three are bodies or collections of water."
- Target Words: [SWORD, SHIELD, ARMOR]. Clue: "Knight". Reasoning: "All three are standard equipment directly associated with knights."

You must output ONLY valid JSON in the format: {"reasoning": "Explain your thought process here", "clue": "YOUR_CLUE_WORD", "count": ${targetCount}}.
Language: ${language}
${activeModifier ? `\nACTIVE CHAOS MODIFIER: ${activeModifier}\nModifier State: ${JSON.stringify(modifierState)}\nEnsure your clue adheres to the rules of this modifier.` : ""}`;

  const userPrompt = `Board State:
Target Words to connect: [${targetWords.join(", ")}]
Enemy Words to avoid: ${enemyWords.join(", ")}
Neutral Words to avoid: ${neutralWords.join(", ")}
Assassin Words (FATAL TO AVOID): ${assassinWords.join(", ")}

Generate a clue! Remember to output ONLY JSON.`;

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      if (parsed.clue && parsed.count !== undefined) {
        let finalClue = parsed.clue.trim();
        const finalCount = Number(parsed.count);
        if (finalClue.includes(" ")) {
          console.warn(
            `[AI-SPY] LLM returned a phrase "${finalClue}" — taking first word.`,
          );
          finalClue = finalClue.split(" ")[0];
        }
        if (!isNaN(finalCount)) {
          console.log(
            `[AI-SPY] Valid clue parsed: "${finalClue}" x${finalCount}`,
          );
          return {
            word: finalClue,
            count: finalCount,
            reasoning: parsed.reasoning || "No reasoning provided.",
          };
        } else {
          console.warn(
            `[AI-SPY] Count could not be parsed as a number:`,
            parsed.count,
          );
        }
      } else {
        console.warn(
          `[AI-SPY] Parsed JSON but missing clue/count fields:`,
          parsed,
        );
      }
    }
  } catch (err) {
    console.error("[AI-SPY] Groq request failed:", err);
  }

  // Fallback if LLM fails
  console.warn(`[AI-SPY] Falling back to local AI after Groq failure.`);
  return getBotSpymasterClue(
    cards,
    team,
    language,
    isDuet,
    activeModifier,
    modifierState,
  );
}

export async function getLLMOperativeRankings(
  clue: string,
  count: number,
  cards: import("../../../shared/types").Card[],
  team: import("../../../shared/types").Team,
  language: string,
  isDuet: boolean,
  activeModifier: string | null = null,
  modifierState: any = null,
): Promise<{
  cards: import("../../../shared/types").Card[];
  reasoning?: string;
}> {
  console.log(
    `[AI-OP] getLLMOperativeRankings called. Team: ${team}, clue: "${clue}" x${count}, groqReady: ${!!groq}`,
  );

  if (!groq) {
    console.warn(`[AI-OP] No Groq client — falling back to local AI.`);
    return {
      cards: await rankCardsForOperative(clue, cards, team, language, isDuet),
      reasoning: "Local AI fallback (No Groq key)",
    };
  }

  const unrevealed = cards.filter((c) => {
    if (isDuet) return team === "red" ? !c.revealedByB : !c.revealedByA;
    return !c.revealed;
  });

  const availableWords = unrevealed.map((c) => c.word);

  if (availableWords.length === 0) return { cards: [] };

  const systemPrompt = `You are an expert Operative in Codenames.
You have received a clue from your Spymaster. This clue may be a single word or a multi-word phrase.
Your task is to extract the core semantic meaning from the phrase and map that meaning to the provided array of available board cards.
You MUST STRICTLY select words ONLY from the exact strings in the board array. Under no circumstances can you select a word not present on the board.

CRITICAL RULES FOR LOGIC:
1. NO STORYTELLING OR NARRATIVE CHAINING: Do NOT invent complex scenarios, stories, or circumstantial setups to link words (e.g., "people drinking from straws at stadium stands because they are cold and disease spreads in stadiums" is a completely illegal, fabricated chain connection). 
2. DIRECT 1-TO-1 SEMANTIC MATCHES ONLY: A card must share a direct, immediate, dictionary-grade relation to the clue (e.g., synonyms, direct hypernyms/hyponyms, or extremely strong, direct, universally recognized associations).
3. STRICT REJECTION OF SPECULATIVE LINKS: If a connection requires more than a single obvious hop or relies on a convoluted "what-if" context, score it as zero connection and rank it at the bottom.
4. If a word has multiple possible meanings, evaluate only direct, standard associations for those specific meanings.

You must output ONLY valid JSON in the format: {"reasoning": "Explain your logic step-by-step", "rankedWords": ["word1", "word2", ...]}.
Order the words from most likely to least likely.
Language: ${language}
${activeModifier ? `\nACTIVE CHAOS MODIFIER: ${activeModifier}\nModifier State: ${JSON.stringify(modifierState)}\nThe board words may be altered or the rules changed.` : ""}`;

  const userPrompt = `Spymaster Clue: "${clue}" for ${count} cards.
Available Words on Board: ${availableWords.join(", ")}

Rank the available words by how well they match the clue's semantic meaning. Include ALL available words in your ranking. Output ONLY JSON.`;

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.rankedWords)) {
        console.log(`[AI-OP] Ranked words from LLM:`, parsed.rankedWords);
        const rankedCards: import("../../../shared/types").Card[] = [];
        for (const w of parsed.rankedWords) {
          const card = unrevealed.find(
            (c) => c.word.toLowerCase() === (w as string).toLowerCase(),
          );
          if (card) rankedCards.push(card);
        }

        // Append any missed cards to the end
        unrevealed.forEach((c) => {
          if (!rankedCards.find((rc) => rc.id === c.id)) {
            rankedCards.push(c);
          }
        });

        console.log(
          `[AI-OP] Final ranked cards (${rankedCards.length}):`,
          rankedCards.slice(0, 5).map((c) => c.word),
        );
        return {
          cards: rankedCards,
          reasoning: parsed.reasoning || "No reasoning provided.",
        };
      } else {
        console.warn(
          `[AI-OP] Parsed JSON but missing rankedWords array:`,
          parsed,
        );
      }
    }
  } catch (err) {
    console.error("[AI-OP] Groq request failed:", err);
  }

  // Fallback
  console.warn(
    `[AI-OP] Falling back to local operative ranking after Groq failure.`,
  );
  return {
    cards: await rankCardsForOperative(clue, cards, team, language, isDuet),
    reasoning: "Local AI fallback (Groq error)",
  };
}
