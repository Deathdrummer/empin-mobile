export const REACTIONS_HEIGHT = 52;
export const ACTION_HEIGHT = 46;
export const GAP = 8;
export const SIDE = 10;
export const MENU_WIDTH = 236;
const MIN_PREVIEW = 96;
// Меньше двух действий не показываем: остальные — прокруткой
const MIN_VISIBLE_ACTIONS = 2;

/**
 * Раскладка меню сообщения в пределах безопасной зоны на любом экране (маленький телефон,
 * телефон боком, разделённый экран): реакции над сообщением, действия под ним.
 * Высота делится так: действиям — сколько поместится (не меньше двух, остальные прокручиваются),
 * сообщению — остаток, но хотя бы небольшой кусок; длинное сообщение обрезается.
 * Группа сдвигается от краёв, верх в приоритете: реакции не уходят за экран.
 */
export const layoutMessageMenu = ({ windowWidth, windowHeight, insets, anchor, actionsCount, isMine, sideOffset = 0 }) => {
  const topLimit = insets.top + GAP;
  const bottomLimit = windowHeight - insets.bottom - GAP;
  // Место под сообщение и действия (без реакций и промежутков)
  const room = Math.max(0, bottomLimit - topLimit - REACTIONS_HEIGHT - GAP * 2);

  const fullMenu = actionsCount * ACTION_HEIGHT;
  const minMenu = Math.min(fullMenu, MIN_VISIBLE_ACTIONS * ACTION_HEIGHT);
  const minPreview = Math.min(anchor.height, MIN_PREVIEW);
  const menuHeight = Math.min(fullMenu, Math.max(minMenu, room - minPreview));
  const previewHeight = Math.max(0, Math.min(anchor.height, room - menuHeight));

  let previewTop = anchor.y;
  const groupBottom = previewTop + previewHeight + GAP + menuHeight;
  if (groupBottom > bottomLimit) previewTop -= groupBottom - bottomLimit;
  const minPreviewTop = topLimit + REACTIONS_HEIGHT + GAP;
  if (previewTop < minPreviewTop) previewTop = minPreviewTop;

  // По горизонтали — от своего края до противоположного
  const offset = isMine ? SIDE : SIDE + sideOffset;
  const maxWidth = Math.max(0, windowWidth - offset - SIDE);

  return {
    previewTop,
    previewHeight,
    reactionsTop: previewTop - GAP - REACTIONS_HEIGHT,
    menuTop: previewTop + previewHeight + GAP,
    menuHeight,
    menuScrolls: menuHeight < fullMenu,
    align: isMine ? { right: SIDE } : { left: offset },
    reactionsMaxWidth: maxWidth,
    menuWidth: Math.min(MENU_WIDTH, maxWidth),
  };
};
