import type { Card, CardType, Language, Team, CustomWordWeight } from './types';
import { wordPackRegistry } from './wordPacks';

export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function getOfficialWords(language: Language, selectedPacks: string[]): string[] {
  let combinedArrays: string[] = [];
  
  const langsToPull = language === 'all' 
    ? (Object.keys(wordPackRegistry) as Language[])
    : [language];
  
  selectedPacks.forEach(pack => {
    langsToPull.forEach(lang => {
      // @ts-ignore
      if (wordPackRegistry[lang] && wordPackRegistry[lang][pack]) {
        // @ts-ignore
        combinedArrays = combinedArrays.concat(wordPackRegistry[lang][pack]);
      }
    });
  });

  return Array.from(new Set(combinedArrays));
}

export function buildFinalWordList(
  language: Language,
  selectedPacks: string[],
  customWords: string[],
  customWordWeight: CustomWordWeight
): string[] {
  let officialWords = getOfficialWords(language, selectedPacks);
  
  if (officialWords.length === 0) {
    officialWords = getOfficialWords('en', ['classic']);
  }
  
  let targetCustomCount = 0;
  if (customWordWeight === 'none') targetCustomCount = 0;
  else if (customWordWeight === 'few') targetCustomCount = 5;
  else if (customWordWeight === 'some') targetCustomCount = 12;
  else if (customWordWeight === 'many') targetCustomCount = 25;
  
  const actualCustomCount = Math.min(targetCustomCount, customWords.length);
  const selectedCustom = shuffleArray(customWords).slice(0, actualCustomCount);
  
  const officialNeeded = 25 - actualCustomCount;
  const selectedOfficial = shuffleArray(officialWords).slice(0, officialNeeded);
  
  const combined25 = shuffleArray([...selectedCustom, ...selectedOfficial]);
  
  if (combined25.length < 25) {
     const failsafe = shuffleArray(getOfficialWords('en', ['classic'])).slice(0, 25 - combined25.length);
     return shuffleArray([...combined25, ...failsafe]);
  }
  
  return combined25;
}

export function generateGrid(
  language: Language, 
  selectedPacks: string[] = ['classic'],
  customWords: string[] = [],
  customWordWeight: CustomWordWeight = 'none'
): { cards: Card[], startingTeam: Team } {
  const shuffledWords = buildFinalWordList(language, selectedPacks, customWords, customWordWeight);
  
  const startingTeam: Team = Math.random() > 0.5 ? 'red' : 'blue';
  const secondTeam: Team = startingTeam === 'red' ? 'blue' : 'red';
  
  const types: CardType[] = [
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(secondTeam),
    ...Array(7).fill('neutral'),
    'assassin'
  ];
  
  const shuffledTypes = shuffleArray(types);
  
  const cards: Card[] = shuffledWords.map((word, index) => ({
    id: index,
    word,
    type: shuffledTypes[index] as CardType,
    revealed: false
  }));
  
  return { cards, startingTeam };
}

export function generateDuetGrid(
  language: Language, 
  selectedPacks: string[] = ['duet'],
  customWords: string[] = [],
  customWordWeight: CustomWordWeight = 'none'
): { cards: Card[], startingTeam: Team } {
  const shuffledWords = buildFinalWordList(language, selectedPacks, customWords, customWordWeight);
  
  const map = [
    ...Array(3).fill({ a: 'green', b: 'green' }),
    { a: 'assassin', b: 'assassin' },
    { a: 'assassin', b: 'green' },
    { a: 'green', b: 'assassin' },
    ...Array(5).fill({ a: 'green', b: 'neutral' }),
    ...Array(5).fill({ a: 'neutral', b: 'green' }),
    { a: 'assassin', b: 'neutral' },
    { a: 'neutral', b: 'assassin' },
    ...Array(7).fill({ a: 'neutral', b: 'neutral' })
  ];

  const shuffledMap = shuffleArray(map);
  
  const cards: Card[] = shuffledWords.map((word, index) => ({
    id: index,
    word,
    type: 'neutral',
    duetTypeA: shuffledMap[index].a as CardType,
    duetTypeB: shuffledMap[index].b as CardType,
    revealed: false,
    revealedByA: false,
    revealedByB: false
  }));
  
  return { cards, startingTeam: 'red' };
}
