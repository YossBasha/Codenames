const fs = require('fs');

const wordsPath = 'C:\\\\Users\\\\yossu\\\\OneDrive\\\\Desktop\\\\Programing\\\\Games\\\\Codenames\\\\shared\\\\words.ts';
const wordPacksPath = 'C:\\\\Users\\\\yossu\\\\OneDrive\\\\Desktop\\\\Programing\\\\Games\\\\Codenames\\\\shared\\\\wordPacks.ts';

const content = fs.readFileSync(wordsPath, 'utf-8');

let englishArrayStr = content.match(/export const englishWords = \\[(.*?)\\];/s)[1];
let englishArray = englishArrayStr.split(',').map(s => s.trim().replace(/"/g, '')).filter(s => s);

let arabicArrayStr = content.match(/export const arabicWords = \\[(.*?)\\];/s)[1];
let arabicArray = arabicArrayStr.split(',').map(s => s.trim().replace(/"/g, '')).filter(s => s);

const enClassic = englishArray.slice(0, 200).map(w => '"' + w + '"').join(', ');
const enDuet = englishArray.slice(200).map(w => '"' + w + '"').join(', ');
const arClassic = arabicArray.slice(0, 200).map(w => '"' + w + '"').join(', ');
const arDuet = arabicArray.slice(200).map(w => '"' + w + '"').join(', ');

const fileContent = 'export interface WordPackRegistry {\\n' +
'  [languageCode: string]: {\\n' +
'    [packName: string]: string[];\\n' +
'  };\\n' +
'}\\n\\n' +
'export const wordPackRegistry: WordPackRegistry = {\\n' +
'  en: {\\n' +
'    classic: [' + enClassic + '],\\n' +
'    duet: [' + enDuet + '],\\n' +
'  },\\n' +
'  ar: {\\n' +
'    classic: [' + arClassic + '],\\n' +
'    duet: [' + arDuet + '],\\n' +
'  }\\n' +
'};\\n';

fs.writeFileSync(wordPacksPath, fileContent);
fs.unlinkSync(wordsPath);
