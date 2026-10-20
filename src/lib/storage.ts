export interface Settings {
  sound: boolean;
  haptics: boolean;
}

const HIGH_SCORE_KEY = 'alien-attack:highscore';
const SETTINGS_KEY = 'alien-attack:settings';

export function loadHighScore(): number {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    /* storage unavailable */
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        sound: parsed.sound !== false,
        haptics: parsed.haptics !== false,
      };
    }
  } catch {
    /* storage unavailable */
  }
  return { sound: true, haptics: true };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}
