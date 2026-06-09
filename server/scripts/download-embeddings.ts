// @ts-nocheck
const fs = require('fs');
const https = require('https');
const path = require('path');
const { wordPackRegistry } = require('../../shared/wordPacks');

const ASSETS_DIR = path.join(__dirname, '../assets');
const EMBEDDINGS_FILE = path.join(ASSETS_DIR, 'embeddings.json');

const EMBEDDINGS_URL = 'https://raw.githubusercontent.com/devmount/glove-word-vectors/master/glove.6B.50d.json';

function generateFallbackEmbeddings() {
  console.log('⚠️ Failed to download real embeddings. Generating fallback dictionary...');
  const dict: Record<string, number[]> = {};
  
  const words: string[] = [];
  
  for (const lang in wordPackRegistry) {
    for (const pack in wordPackRegistry[lang]) {
      if (pack === 'emojis') continue;
      words.push(...wordPackRegistry[lang][pack].map((w: string) => w.toLowerCase()));
    }
  }

  const clues = ['animal', 'water', 'building', 'tool', 'person', 'food', 'nature', 'machine', 'color', 'danger'];
  words.push(...clues);

  words.forEach(word => {
    const vec: number[] = [];
    for (let i = 0; i < 50; i++) {
      vec.push((Math.random() * 2) - 1);
    }
    dict[word] = vec;
  });

  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }

  fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(dict));
  console.log('✅ Fallback embeddings generated at:', EMBEDDINGS_FILE);
  console.log('❌ WARNING: AI bots will give nonsensical clues because they are using random math. Please provide a real GloVe JSON file.');
}

function downloadEmbeddings() {
  console.log(`⬇️ Downloading word embeddings from ${EMBEDDINGS_URL}...`);
  
  https.get(EMBEDDINGS_URL, (res: any) => {
    if (res.statusCode !== 200) {
      console.error(`HTTP Error: ${res.statusCode}`);
      generateFallbackEmbeddings();
      return;
    }

    let data = '';
    res.on('data', (chunk: any) => data += chunk);
    
    res.on('end', () => {
      try {
        JSON.parse(data);
        if (!fs.existsSync(ASSETS_DIR)) {
          fs.mkdirSync(ASSETS_DIR, { recursive: true });
        }
        fs.writeFileSync(EMBEDDINGS_FILE, data);
        console.log('✅ Successfully downloaded and saved real word embeddings!');
      } catch (err: any) {
        console.error('Failed to parse downloaded JSON:', err.message);
        generateFallbackEmbeddings();
      }
    });
  }).on('error', (err: any) => {
    console.error('Download error:', err.message);
    generateFallbackEmbeddings();
  });
}

downloadEmbeddings();
