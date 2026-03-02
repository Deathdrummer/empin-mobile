import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { refreshPermissions } from '../utils/permissions';

/**
 * Hook для автоматического обновления прав при возврате в приложение
 * Отслеживает переход AppState из background/inactive в active
 */
export const useAppStatePermissions = () => {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      // Если приложение переходит в active из background/inactive
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        try {
          // Обновляем права с сервера
          await refreshPermissions();
        } catch (error) {
          console.error('Failed to refresh permissions on app focus', { error: error.message });
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);
};
