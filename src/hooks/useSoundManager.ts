import { useState, useEffect, useCallback } from 'react';
import { sounds, SoundPreferences, DEFAULT_SOUND_PREFERENCES } from '../utils/soundEffects';

export function useSoundManager() {
  const [preferences, setPreferences] = useState<SoundPreferences>(() => sounds.getPreferences());

  useEffect(() => {
    setPreferences(sounds.loadPreferences());
  }, []);

  const updatePreferences = useCallback((updates: Partial<SoundPreferences>) => {
    const next = sounds.savePreferences(updates);
    setPreferences({ ...next });
  }, []);

  const toggleMaster = useCallback(() => {
    const next = sounds.savePreferences({ masterEnabled: !preferences.masterEnabled });
    setPreferences({ ...next });
  }, [preferences.masterEnabled]);

  const setVolume = useCallback((vol: number) => {
    const bounded = Math.max(0, Math.min(100, Math.round(vol)));
    const next = sounds.savePreferences({ volume: bounded });
    setPreferences({ ...next });
  }, []);

  const playDeal = useCallback(() => sounds.playDealSound(), []);
  const playCardPlay = useCallback(() => sounds.playCardPlaySound(), []);
  const playTrickWin = useCallback(() => sounds.playTrickWinSound(), []);
  const playDeclare = useCallback(() => sounds.playDeclareSound(), []);
  const playVictory = useCallback(() => sounds.playVictoryFanfare(), []);
  const playClick = useCallback(() => sounds.playButtonClick(), []);

  return {
    preferences,
    updatePreferences,
    toggleMaster,
    setVolume,
    playDeal,
    playCardPlay,
    playTrickWin,
    playDeclare,
    playVictory,
    playClick,
  };
}
