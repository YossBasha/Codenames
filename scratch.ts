import * as fs from 'fs';
import { englishWords, arabicWords } from './shared/words.ts';

const enClassic = englishWords.slice(0, 200).map(w => '"' + w + '"').join(', ');
const enDuet = englishWords.slice(200).map(w => '"' + w + '"').join(', ');
const arClassic = arabicWords.slice(0, 200).map(w => '"' + w + '"').join(', ');
const arDuet = arabicWords.slice(200).map(w => '"' + w + '"').join(', ');

const fileContent = `export interface WordPackRegistry {
  [languageCode: string]: {
    [packName: string]: string[];
  };
}

export const wordPackRegistry: WordPackRegistry = {
  en: {
    classic: [${enClassic}],
    duet: [${enDuet}],
  },
  ar: {
    classic: [${arClassic}],
    duet: [${arDuet}],
  }
};
`;

fs.writeFileSync('C:\\\\Users\\\\yossu\\\\OneDrive\\\\Desktop\\\\Programing\\\\Games\\\\Codenames\\\\shared\\\\wordPacks.ts', fileContent);
fs.unlinkSync('C:\\\\Users\\\\yossu\\\\OneDrive\\\\Desktop\\\\Programing\\\\Games\\\\Codenames\\\\shared\\\\words.ts');
