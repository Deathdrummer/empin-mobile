// Раскладка меню сообщения: всё в пределах экрана на любых размерах. Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutMessageMenu, ACTION_HEIGHT, GAP, REACTIONS_HEIGHT, SIDE } from './messageMenuLayout.js';

// Ширина полосы реакций по содержимому: 8 кнопок по 42 + промежутки + поля
const REACTIONS_CONTENT = 8 * 42 + 7 * 2 + 12;

const screens = {
  'iPhone 17 Pro Max': { windowWidth: 440, windowHeight: 956, insets: { top: 62, bottom: 34 } },
  'iPhone SE': { windowWidth: 375, windowHeight: 667, insets: { top: 20, bottom: 0 } },
  'Android 360×640, кнопки навигации': { windowWidth: 360, windowHeight: 640, insets: { top: 24, bottom: 48 } },
  'Маленький Android 320×568': { windowWidth: 320, windowHeight: 568, insets: { top: 24, bottom: 48 } },
  'Телефон боком': { windowWidth: 844, windowHeight: 390, insets: { top: 0, bottom: 21 } },
  'Разделённый экран': { windowWidth: 360, windowHeight: 300, insets: { top: 0, bottom: 0 } },
};

const anchors = {
  'короткое вверху': { y: 30, height: 44 },
  'короткое внизу': { y: 2000, height: 44 },
  'длинное': { y: 120, height: 900 },
};

const check = (screen, anchor, options) => {
  const layout = layoutMessageMenu({ ...screen, anchor, actionsCount: 8, ...options });
  const top = screen.insets.top + GAP;
  const bottom = screen.windowHeight - screen.insets.bottom - GAP;

  assert.ok(layout.reactionsTop >= top - 0.5, `реакции выше экрана: ${layout.reactionsTop} < ${top}`);
  assert.ok(layout.menuTop + layout.menuHeight <= bottom + 0.5, `действия ниже экрана: ${layout.menuTop + layout.menuHeight} > ${bottom}`);
  assert.ok(layout.previewHeight >= 0, 'отрицательная высота сообщения');
  assert.ok(layout.menuHeight >= Math.min(8, 2) * ACTION_HEIGHT, 'видно меньше двух действий');
  // Не помещаются все действия — их можно прокрутить
  if (layout.menuHeight < 8 * ACTION_HEIGHT) assert.ok(layout.menuScrolls, 'действия обрезаны без прокрутки');

  const left = layout.align.left ?? screen.windowWidth - layout.align.right - Math.min(REACTIONS_CONTENT, layout.reactionsMaxWidth);
  const reactionsRight = left + Math.min(REACTIONS_CONTENT, layout.reactionsMaxWidth);
  assert.ok(left >= SIDE - 0.5 && reactionsRight <= screen.windowWidth - SIDE + 0.5,
    `реакции за краем: ${left}…${reactionsRight} при ширине ${screen.windowWidth}`);
  const menuLeft = layout.align.left ?? screen.windowWidth - layout.align.right - layout.menuWidth;
  assert.ok(menuLeft >= SIDE - 0.5 && menuLeft + layout.menuWidth <= screen.windowWidth - SIDE + 0.5,
    `действия за краем: ${menuLeft}…${menuLeft + layout.menuWidth}`);
  assert.ok(layout.reactionsTop + REACTIONS_HEIGHT <= layout.previewTop, 'реакции наезжают на сообщение');
};

for (const [screenName, screen] of Object.entries(screens)) {
  for (const [anchorName, anchor] of Object.entries(anchors)) {
    test(`${screenName}: ${anchorName}, своё`, () => check(screen, anchor, { isMine: true }));
    test(`${screenName}: ${anchorName}, чужое в группе (с аватаром)`, () => check(screen, anchor, { isMine: false, sideOffset: 30 }));
  }
}

test('на большом экране короткое сообщение остаётся на своём месте, все действия видны', () => {
  const layout = layoutMessageMenu({ ...screens['iPhone 17 Pro Max'], anchor: { y: 400, height: 60 }, actionsCount: 8, isMine: true });
  assert.equal(layout.previewTop, 400);
  assert.equal(layout.previewHeight, 60);
  assert.equal(layout.menuHeight, 8 * ACTION_HEIGHT);
  assert.equal(layout.menuScrolls, false);
});
