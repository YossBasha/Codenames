"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shuffleArray = shuffleArray;
exports.buildFinalWordList = buildFinalWordList;
exports.generateGrid = generateGrid;
exports.generateDuetGrid = generateDuetGrid;
const wordPacks_1 = require("./wordPacks");
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}
function getOfficialWords(language, selectedPacks) {
    let combinedArrays = [];
    const langsToPull = language === 'all'
        ? Object.keys(wordPacks_1.wordPackRegistry)
        : [language];
    selectedPacks.forEach(pack => {
        langsToPull.forEach(lang => {
            // @ts-ignore
            if (wordPacks_1.wordPackRegistry[lang] && wordPacks_1.wordPackRegistry[lang][pack]) {
                // @ts-ignore
                combinedArrays = combinedArrays.concat(wordPacks_1.wordPackRegistry[lang][pack]);
            }
        });
    });
    return Array.from(new Set(combinedArrays));
}
function buildFinalWordList(language, selectedPacks, customWords, customWordWeight) {
    let officialWords = getOfficialWords(language, selectedPacks);
    if (officialWords.length === 0) {
        officialWords = getOfficialWords('en', ['classic']);
    }
    let targetCustomCount = 0;
    if (customWordWeight === 'none')
        targetCustomCount = 0;
    else if (customWordWeight === 'few')
        targetCustomCount = 5;
    else if (customWordWeight === 'some')
        targetCustomCount = 12;
    else if (customWordWeight === 'many')
        targetCustomCount = 25;
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
function generateGrid(language, selectedPacks = ['classic'], customWords = [], customWordWeight = 'none') {
    const shuffledWords = buildFinalWordList(language, selectedPacks, customWords, customWordWeight);
    const startingTeam = Math.random() > 0.5 ? 'red' : 'blue';
    const secondTeam = startingTeam === 'red' ? 'blue' : 'red';
    const types = [
        ...Array(9).fill(startingTeam),
        ...Array(8).fill(secondTeam),
        ...Array(7).fill('neutral'),
        'assassin'
    ];
    const shuffledTypes = shuffleArray(types);
    const cards = shuffledWords.map((word, index) => ({
        id: index,
        word,
        type: shuffledTypes[index],
        revealed: false
    }));
    return { cards, startingTeam };
}
function generateDuetGrid(language, selectedPacks = ['duet'], customWords = [], customWordWeight = 'none') {
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
    const cards = shuffledWords.map((word, index) => ({
        id: index,
        word,
        type: 'neutral',
        duetTypeA: shuffledMap[index].a,
        duetTypeB: shuffledMap[index].b,
        revealed: false,
        revealedByA: false,
        revealedByB: false
    }));
    return { cards, startingTeam: 'red' };
}
//# sourceMappingURL=gameLogic.js.map