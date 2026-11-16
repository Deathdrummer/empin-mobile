import { useContext } from 'react';
import { Platform } from 'react-native';
import { BottomTabBarHeightContext } from 'react-native-bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// На Android нативный BottomNavigationView лежит ниже сцены (не перекрывает контент);
// на iOS сцена заходит под полупрозрачный UITabBar (Liquid Glass) — списки берут этот отступ снизу.
const IOS_DEFAULT_BAR_HEIGHT = 49;

/**
 * Высота нижней панели вкладок поверх контента:
 * на iOS возвращается фактическая высота системного UITabBar (с запасом до первого измерения),
 * на Android и на экранах стека вне таб-навигатора (например, «Архив») — 0.
 */
export const useTabBarHeight = () => {
  const measured = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();
  if (Platform.OS !== 'ios' || measured === undefined) return 0;
  return measured > 0 ? measured : IOS_DEFAULT_BAR_HEIGHT + insets.bottom;
};
