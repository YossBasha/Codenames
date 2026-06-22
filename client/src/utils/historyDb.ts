import type { LogEntry, GameMode } from '../../../shared/types';

export interface GameHistoryEntry {
  id: string;
  timestamp: number;
  gameMode: GameMode;
  winner: string;
  logs: LogEntry[];
  players?: { name: string; avatarUrl: string }[];
}

const DB_NAME = 'CodenamesHistoryDB';
const STORE_NAME = 'games';
const DB_VERSION = 1;
const MAX_GAMES = 50;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function saveGameHistory(entry: GameHistoryEntry): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Save the new entry
    store.put(entry);

    // Enforce MAX_GAMES limit
    const request = store.getAll();
    request.onsuccess = () => {
      const allGames = request.result as GameHistoryEntry[];
      if (allGames.length > MAX_GAMES) {
        // Sort ascending by timestamp (oldest first)
        allGames.sort((a, b) => a.timestamp - b.timestamp);
        const gamesToDelete = allGames.length - MAX_GAMES;
        for (let i = 0; i < gamesToDelete; i++) {
          store.delete(allGames[i].id);
        }
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getGameHistories(): Promise<GameHistoryEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort descending by timestamp (newest first)
      const results = (request.result as GameHistoryEntry[]).sort(
        (a, b) => b.timestamp - a.timestamp
      );
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearHistory(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
