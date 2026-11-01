/** Состояния, в которых звонок уже завершён: экран показывает итог и закрывается сам */
const FINISHED = ['ended', 'no_answer', 'rejected', 'error'];

/**
 * Какие кнопки на экране звонка. Крестика нет: пока звонок не завершён, выход — только красная кнопка,
 * поэтому она есть в любом незавершённом состоянии, в том числе в непредвиденном.
 */
export const callScreenActions = (status, isIncoming) => {
  if (FINISHED.includes(status)) return 'none';
  if (status === 'active') return 'talk';
  if (status === 'ringing' && isIncoming) return 'incoming';
  return 'outgoing';
};
