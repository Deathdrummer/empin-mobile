import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// Запасной путь, если iOS не сообщит о закрытии (окно не успело показаться)
const FALLBACK_MS = 700;

/**
 * Действие, которое открывает новое окно (шторку, «Поделиться», экран звонка, Alert), — только после того,
 * как текущее окно (Modal) закрылось. На iOS окно, показанное пока другое ещё закрывается, не появляется,
 * а приложение перестаёт отвечать на касания. iOS сообщает о закрытии через onDismiss у Modal;
 * на Android Modal закрывается сразу (onDismiss там не вызывается) — действие выполняется тут же.
 *
 *   const { closeThen, onDismiss } = useAfterModalClose();
 *   <Modal visible={visible} onDismiss={onDismiss}>…
 *   closeThen(() => setVisible(false), () => openNext());
 */
export const useAfterModalClose = () => {
  const pendingRef = useRef(null);
  const timerRef = useRef(null);

  const onDismiss = useCallback(() => {
    clearTimeout(timerRef.current);
    const action = pendingRef.current;
    pendingRef.current = null;
    action?.();
  }, []);

  const closeThen = useCallback((close, action) => {
    pendingRef.current = action;
    close();
    if (Platform.OS !== 'ios') {
      onDismiss();
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onDismiss, FALLBACK_MS);
  }, [onDismiss]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { closeThen, onDismiss };
};
