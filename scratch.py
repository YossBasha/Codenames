import re

with open('C:\\\\Users\\\\yossu\\\\OneDrive\\\\Desktop\\\\Programing\\\\Games\\\\Codenames\\\\shared\\\\words.ts', 'r', encoding='utf-8') as f:
    content = f.read()

en_match = re.search(r'export const englishWords = \[(.*?)\];', content, re.DOTALL)
ar_match = re.search(r'export const arabicWords = \[(.*?)\];', content, re.DOTALL)

en_words = [w.strip().strip('"') for w in en_match.group(1).split(',') if w.strip()]
ar_words = [w.strip().strip('"') for w in ar_match.group(1).split(',') if w.strip()]

en_classic = en_words[:200]
en_duet = en_words[200:]
ar_classic = ar_words[:200]
ar_duet = ar_words[200:]

out = """export interface WordPackRegistry {
  [languageCode: string]: {
    [packName: string]: string[];
  };
}

export const wordPackRegistry: WordPackRegistry = {
  en: {
    classic: [%s],
    duet: [%s]
  },
  ar: {
    classic: [%s],
    duet: [%s]
  }
};
""" % (
    ", ".join(f'"{w}"' for w in en_classic),
    ", ".join(f'"{w}"' for w in en_duet),
    ", ".join(f'"{w}"' for w in ar_classic),
    ", ".join(f'"{w}"' for w in ar_duet),
)

with open('C:\\\\Users\\\\yossu\\\\OneDrive\\\\Desktop\\\\Programing\\\\Games\\\\Codenames\\\\shared\\\\wordPacks.ts', 'w', encoding='utf-8') as f:
    f.write(out)
