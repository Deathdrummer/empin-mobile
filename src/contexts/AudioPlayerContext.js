import React, { createContext, useContext, useRef } from 'react';

const AudioPlayerContext = createContext(null);

export const AudioPlayerProvider = ({ children }) => {
  const currentPlayerRef = useRef(null);

  const registerPlayer = (player) => {
    // Если уже есть активный плеер и он воспроизводится, останавливаем его
    if (currentPlayerRef.current && currentPlayerRef.current !== player) {
      try {
        currentPlayerRef.current.pause();
      } catch (error) {
        console.error('Failed to pause previous player', { error: error.message });
      }
    }
    currentPlayerRef.current = player;
  };

  const unregisterPlayer = (player) => {
    if (currentPlayerRef.current === player) {
      currentPlayerRef.current = null;
    }
  };

  return (
    <AudioPlayerContext.Provider value={{ registerPlayer, unregisterPlayer }}>
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
