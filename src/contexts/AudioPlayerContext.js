import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AudioPlayerContext = createContext(null);

const AUDIO_PLAYBACK_RATE_KEY = '@audio_playback_rate';
const VIDEO_PLAYBACK_RATE_KEY = '@video_playback_rate';

export const AudioPlayerProvider = ({ children }) => {
  const currentPlayerRef = useRef(null);
  const [audioPlaybackRate, setAudioPlaybackRateState] = useState(1.0);
  const [videoPlaybackRate, setVideoPlaybackRateState] = useState(1.0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Загрузка сохраненных скоростей при инициализации
  useEffect(() => {
    const loadPlaybackRates = async () => {
      try {
        const [audioRate, videoRate] = await Promise.all([
          AsyncStorage.getItem(AUDIO_PLAYBACK_RATE_KEY),
          AsyncStorage.getItem(VIDEO_PLAYBACK_RATE_KEY),
        ]);

        if (audioRate !== null) {
          const parsedAudioRate = parseFloat(audioRate);
          if (!isNaN(parsedAudioRate)) {
            setAudioPlaybackRateState(parsedAudioRate);
          }
        }

        if (videoRate !== null) {
          const parsedVideoRate = parseFloat(videoRate);
          if (!isNaN(parsedVideoRate)) {
            setVideoPlaybackRateState(parsedVideoRate);
          }
        }
      } catch (error) {
        console.error('Failed to load playback rates', { error: error.message });
      } finally {
        setIsLoaded(true);
      }
    };

    loadPlaybackRates();
  }, []);

  const setAudioPlaybackRate = async (rate) => {
    try {
      setAudioPlaybackRateState(rate);
      await AsyncStorage.setItem(AUDIO_PLAYBACK_RATE_KEY, rate.toString());
    } catch (error) {
      console.error('Failed to save audio playback rate', { error: error.message });
    }
  };

  const setVideoPlaybackRate = async (rate) => {
    try {
      setVideoPlaybackRateState(rate);
      await AsyncStorage.setItem(VIDEO_PLAYBACK_RATE_KEY, rate.toString());
    } catch (error) {
      console.error('Failed to save video playback rate', { error: error.message });
    }
  };

  const registerPlayer = (player, playerId) => {
    // Если уже есть активный плеер с другим ID, останавливаем его
    if (currentPlayerRef.current && currentPlayerRef.current.id !== playerId) {
      console.log('[AudioPlayerContext] Stopping previous player, ID:', currentPlayerRef.current.id);
      try {
        currentPlayerRef.current.player.pause();
      } catch (error) {
        console.error('Failed to pause previous player', { error: error.message });
      }
    }
    console.log('[AudioPlayerContext] Registering new player, ID:', playerId);
    currentPlayerRef.current = { player, id: playerId };
  };

  const unregisterPlayer = (playerId) => {
    if (currentPlayerRef.current && currentPlayerRef.current.id === playerId) {
      currentPlayerRef.current = null;
    }
  };

  return (
    <AudioPlayerContext.Provider
      value={{
        registerPlayer,
        unregisterPlayer,
        audioPlaybackRate,
        setAudioPlaybackRate,
        videoPlaybackRate,
        setVideoPlaybackRate,
        isLoaded,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayerContext = () => {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayerContext must be used within AudioPlayerProvider');
  }
  return context;
};
