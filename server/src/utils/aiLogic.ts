import * as fs from 'fs';
import * as path from 'path';
import { wordPackRegistry } from '../../../shared/wordPacks';

let embeddings: Record<string, number[]> = {};

export function loadEmbeddings() {
  try {
    const embeddingsPath = path.join(__dirname, '../../assets/embeddings.json');
    if (fs.existsSync(embeddingsPath)) {
      const data = fs.readFileSync(embeddingsPath, 'utf8');
      embeddings = JSON.parse(data);
      console.log(`Loaded embeddings for ${Object.keys(embeddings).length} words.`);
    } else {
      console.warn('Embeddings file not found! AI Bots will not work properly until you run npm run download-embeddings');
    }
  } catch (err) {
    console.error('Failed to load embeddings:', err);
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
  if (language === 'en') return word.toLowerCase();
  
  for (const packName in wordPackRegistry[language]) {
    const idx = wordPackRegistry[language][packName].indexOf(word);
    if (idx !== -1 && wordPackRegistry['en'] && wordPackRegistry['en'][packName] && wordPackRegistry['en'][packName][idx]) {
      return wordPackRegistry['en'][packName][idx].toLowerCase();
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

export function getBotSpymasterClue(
  cards: import('../../../shared/types').Card[],
  team: import('../../../shared/types').Team,
  language: string,
  isDuet: boolean
): { word: string; count: number } | null {
  
  // 1. Identify friendly, enemy, and assassin cards
  const unrevealedCards = cards.filter(c => {
    if (isDuet) {
      return team === 'red' ? !c.revealedByA : !c.revealedByB;
    }
    return !c.revealed;
  });

  const friendlyCards: typeof cards = [];
  const dangerCards: typeof cards = []; // Assassins and Enemies

  unrevealedCards.forEach(c => {
    let type = c.type;
    if (isDuet) {
      type = team === 'red' ? c.duetTypeA! : c.duetTypeB!;
    }
    
    // In Duet, green is an assassin for the side guessing it! Wait, no.
    // In Duet: 
    // Side A sees: green = 3 assassins, black = 1 assassin, blue/red = neutral or agent.
    // Wait! In Duet, Spymaster is giving clues to the OTHER side.
    // If Bot is Red (Side A), it gives clues to Blue (Side B).
    // The keycard Side A uses is to guide Side B.
    // So the targets for Side A Spymaster are `green` cards on Side A's keycard!
    // The dangers are `assassin` (the 3 black ones) on Side A's keycard!
    // Wait, let's look at Duet rules:
    // Side A's keycard shows 9 green (agents), 3 black (assassins).
    // The Bot on Side A must give clues linking the 9 green words.
    // It must avoid the 3 black words.
    if (isDuet) {
      if (type === 'green') friendlyCards.push(c);
      if (type === 'assassin') dangerCards.push(c);
    } else {
      if (type === team) friendlyCards.push(c);
      else if (type !== 'neutral') dangerCards.push(c);
    }
  });

  if (friendlyCards.length === 0) return null;

  // 2. Generate vector average for groups
  // We'll just look at pairs for simplicity, and individual cards
  let bestClue = null;
  let highestScore = -Infinity;
  let bestCount = 1;

  // Fallback if we only have 1 card
  const combos = friendlyCards.map(c => [c]);
  
  // Create pairs
  for (let i = 0; i < friendlyCards.length; i++) {
    for (let j = i + 1; j < friendlyCards.length; j++) {
      combos.push([friendlyCards[i], friendlyCards[j]]);
    }
  }

  // To save CPU, only check up to 50 combos
  const shuffledCombos = combos.sort(() => Math.random() - 0.5).slice(0, 50);

  const allWords = getAllDictionaryWords();

  for (const combo of shuffledCombos) {
    // Calculate centroid
    const vectors = combo.map(c => getWordVector(c.word, language)).filter(v => v !== null) as number[][];
    if (vectors.length === 0) continue;

    const centroid = new Array(50).fill(0);
    for (const vec of vectors) {
      for (let i = 0; i < 50; i++) centroid[i] += vec[i];
    }
    for (let i = 0; i < 50; i++) centroid[i] /= vectors.length;

    // Search dictionary
    for (const dictWord of allWords) {
      // Disallow words already on the board
      if (cards.some(c => getEnglishEquivalent(c.word, language) === dictWord)) continue;

      const dictVec = embeddings[dictWord];
      const similarity = cosineSimilarity(centroid, dictVec);

      if (similarity > highestScore) {
        // Danger check
        let tooDangerous = false;
        for (const danger of dangerCards) {
          const dangerVec = getWordVector(danger.word, language);
          if (dangerVec) {
            const dangerSim = cosineSimilarity(dictVec, dangerVec);
            // Threshold for danger
            if (dangerSim > 0.65) {
              tooDangerous = true;
              break;
            }
          }
        }

        if (!tooDangerous) {
          highestScore = similarity;
          bestClue = dictWord;
          bestCount = combo.length;
        }
      }
    }
  }

  if (bestClue) {
    return { word: bestClue, count: bestCount };
  }
  
  return null;
}

export function rankCardsForOperative(
  clue: string,
  cards: import('../../../shared/types').Card[],
  team: import('../../../shared/types').Team,
  language: string,
  isDuet: boolean
): import('../../../shared/types').Card[] {
  const clueVec = getWordVector(clue, language);
  
  const unrevealed = cards.filter(c => {
    if (isDuet) return team === 'red' ? !c.revealedByB : !c.revealedByA;
    return !c.revealed;
  });

  if (!clueVec) {
    // Fallback: random if clue vector not found
    return unrevealed.sort(() => Math.random() - 0.5);
  }

  const scoredCards = unrevealed.map(c => {
    const cardVec = getWordVector(c.word, language);
    let score = -1;
    if (cardVec) {
      score = cosineSimilarity(clueVec, cardVec);
    }
    return { card: c, score };
  });

  scoredCards.sort((a, b) => b.score - a.score);
  return scoredCards.map(sc => sc.card);
}
