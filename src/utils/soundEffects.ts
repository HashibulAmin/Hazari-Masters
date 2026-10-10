// Web Audio API sound synthesizer for authentic card room sound effects

export interface SoundPreferences {
  masterEnabled: boolean;
  volume: number; // 0 to 100
  dealSound: boolean;
  cardPlaySound: boolean;
  trickWinSound: boolean;
  declareSound: boolean;
  victorySound: boolean;
}

export const DEFAULT_SOUND_PREFERENCES: SoundPreferences = {
  masterEnabled: true,
  volume: 75,
  dealSound: true,
  cardPlaySound: true,
  trickWinSound: true,
  declareSound: true,
  victorySound: true,
};

class SoundEffectsEngine {
  private ctx: AudioContext | null = null;
  private preferences: SoundPreferences = { ...DEFAULT_SOUND_PREFERENCES };

  constructor() {
    this.loadPreferences();
  }

  public loadPreferences(): SoundPreferences {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('hazari_sound_preferences');
        if (stored) {
          this.preferences = { ...DEFAULT_SOUND_PREFERENCES, ...JSON.parse(stored) };
        }
      } catch {}
    }
    return this.preferences;
  }

  public savePreferences(prefs: Partial<SoundPreferences>): SoundPreferences {
    this.preferences = { ...this.preferences, ...prefs };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('hazari_sound_preferences', JSON.stringify(this.preferences));
      } catch {}
    }
    return this.preferences;
  }

  public getPreferences(): SoundPreferences {
    return { ...this.preferences };
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private getEffectiveVolume(baseGain: number): number {
    if (!this.preferences.masterEnabled) return 0;
    const volScale = Math.max(0, Math.min(100, this.preferences.volume)) / 100;
    return baseGain * volScale;
  }

  // Soft whoosh when card deals
  public playDealSound() {
    if (!this.preferences.masterEnabled || !this.preferences.dealSound) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      const effGain = this.getEffectiveVolume(0.22);
      if (effGain <= 0) return;

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, ctx.currentTime);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.09);

      gain.gain.setValueAtTime(effGain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.09);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {}
  }

  // Crisp slap when card is played onto the table
  public playCardPlaySound() {
    if (!this.preferences.masterEnabled || !this.preferences.cardPlaySound) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const effGain = this.getEffectiveVolume(0.28);
      if (effGain <= 0) return;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.07);

      gain.gain.setValueAtTime(effGain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } catch {}
  }

  // Pleasant chime when trick is won
  public playTrickWinSound() {
    if (!this.preferences.masterEnabled || !this.preferences.trickWinSound) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      const baseGain = this.getEffectiveVolume(0.18);
      if (baseGain <= 0) return;

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);

        gain.gain.setValueAtTime(baseGain, ctx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.002, ctx.currentTime + i * 0.08 + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.28);
      });
    } catch {}
  }

  // Distinct harmonic bell when calling a declare / locking in 4-group arrangement
  public playDeclareSound() {
    if (!this.preferences.masterEnabled || !this.preferences.declareSound) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5 arpeggio
      const baseGain = this.getEffectiveVolume(0.22);
      if (baseGain <= 0) return;

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq * 1.5, ctx.currentTime);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);

        gain.gain.setValueAtTime(baseGain, ctx.currentTime + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.002, ctx.currentTime + i * 0.06 + 0.4);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + i * 0.06);
        osc.stop(ctx.currentTime + i * 0.06 + 0.4);
      });
    } catch {}
  }

  // Major chord victory fanfare on 1000 points
  public playVictoryFanfare() {
    if (!this.preferences.masterEnabled || !this.preferences.victorySound) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const melody = [
        { f: 523.25, d: 0.15 }, // C5
        { f: 523.25, d: 0.15 }, // C5
        { f: 523.25, d: 0.15 }, // C5
        { f: 659.25, d: 0.4 },  // E5
        { f: 783.99, d: 0.4 },  // G5
        { f: 1046.5, d: 0.8 },  // C6
      ];

      const baseGain = this.getEffectiveVolume(0.32);
      if (baseGain <= 0) return;

      let t = ctx.currentTime;
      melody.forEach((note) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.f, t);

        gain.gain.setValueAtTime(baseGain, t);
        gain.gain.exponentialRampToValueAtTime(0.005, t + note.d);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + note.d);
        t += note.d * 0.9;
      });
    } catch {}
  }

  // Subtle UI click feedback
  public playButtonClick() {
    if (!this.preferences.masterEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const effGain = this.getEffectiveVolume(0.1);
      if (effGain <= 0) return;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.03);

      gain.gain.setValueAtTime(effGain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    } catch {}
  }
}

export const sounds = new SoundEffectsEngine();
