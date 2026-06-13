"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const fs = require("fs");
const https = require("https");
const path = require("path");
const { wordPackRegistry } = require("../../shared/wordPacks");
const ASSETS_DIR = path.join(__dirname, "../assets");
const EMBEDDINGS_FILE = path.join(ASSETS_DIR, "embeddings.json");
const EMBEDDINGS_URL = "https://raw.githubusercontent.com/devmount/glove-word-vectors/master/glove.6B.50d.json";
function stableVector(word) {
    let hash = 2166136261;
    const normalized = word.toLowerCase().trim();
    for (let i = 0; i < normalized.length; i++) {
        hash ^= normalized.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    const vec = [];
    for (let i = 0; i < 50; i++) {
        hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
        hash ^= hash >>> 13;
        hash = Math.imul(hash ^ (hash >>> 16), 3266489909);
        hash ^= hash >>> 16;
        const value = ((hash >>> 0) % 1000) / 500 - 1;
        vec.push(Number(value.toFixed(6)));
    }
    return vec;
}
function generateFallbackEmbeddings() {
    console.log("⚠️ Failed to download real embeddings. Generating fallback dictionary...");
    const dict = {};
    const words = [];
    // Use only the English pack words for fallback vectors. This avoids
    // generating nonsense clues from other languages or random pack mixes.
    for (const pack in wordPackRegistry.en) {
        if (pack === "emojis")
            continue;
        words.push(...wordPackRegistry.en[pack].map((w) => w.toLowerCase()));
    }
    const clues = [
        "animal",
        "water",
        "building",
        "tool",
        "person",
        "food",
        "nature",
        "machine",
        "color",
        "danger",
    ];
    words.push(...clues);
    words.forEach((word) => {
        dict[word] = stableVector(word);
    });
    if (!fs.existsSync(ASSETS_DIR)) {
        fs.mkdirSync(ASSETS_DIR, { recursive: true });
    }
    fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(dict));
    console.log("✅ Fallback embeddings generated at:", EMBEDDINGS_FILE);
    console.log("❌ WARNING: AI bots are using a deterministic fallback embedding set. Provide a real GloVe JSON file for higher-quality clues.");
}
function downloadEmbeddings() {
    console.log(`⬇️ Downloading word embeddings from ${EMBEDDINGS_URL}...`);
    https
        .get(EMBEDDINGS_URL, (res) => {
        if (res.statusCode !== 200) {
            console.error(`HTTP Error: ${res.statusCode}`);
            generateFallbackEmbeddings();
            return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
            try {
                JSON.parse(data);
                if (!fs.existsSync(ASSETS_DIR)) {
                    fs.mkdirSync(ASSETS_DIR, { recursive: true });
                }
                fs.writeFileSync(EMBEDDINGS_FILE, data);
                console.log("✅ Successfully downloaded and saved real word embeddings!");
            }
            catch (err) {
                console.error("Failed to parse downloaded JSON:", err.message);
                generateFallbackEmbeddings();
            }
        });
    })
        .on("error", (err) => {
        console.error("Download error:", err.message);
        generateFallbackEmbeddings();
    });
}
downloadEmbeddings();
//# sourceMappingURL=download-embeddings.js.map