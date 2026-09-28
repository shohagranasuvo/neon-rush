import { DEFAULT_SETTINGS, STORAGE_KEY, type Settings } from './config';

export interface SaveData {
  highScore: number;
  bestCombo: number;
  longestRun: number;
  runs: number;
  unlocks: string[];
  settings: Settings;
}

const EMPTY: SaveData = {
  highScore: 0,
  bestCombo: 0,
  longestRun: 0,
  runs: 0,
  unlocks: ['default'],
  settings: { ...DEFAULT_SETTINGS },
};

function isSettings(v: unknown): v is Settings {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.master === 'number' &&
    typeof s.sfx === 'number' &&
    typeof s.music === 'number' &&
    typeof s.shake === 'boolean' &&
    typeof s.reduced === 'boolean' &&
    (s.quality === 'low' || s.quality === 'med' || s.quality === 'high')
  );
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY);
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      highScore: Number(parsed.highScore) || 0,
      bestCombo: Number(parsed.bestCombo) || 0,
      longestRun: Number(parsed.longestRun) || 0,
      runs: Number(parsed.runs) || 0,
      unlocks: Array.isArray(parsed.unlocks) ? parsed.unlocks.map(String) : ['default'],
      settings: isSettings(parsed.settings) ? parsed.settings : { ...DEFAULT_SETTINGS },
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}
