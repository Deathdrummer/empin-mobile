import React, { useMemo, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { hasRichContent, linkHref, parseRichText, phoneHref } from '../../utils/richText';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const copy = async (value) => {
  await Clipboard.setStringAsync(value);
  Toast.show({ type: 'success', text1: 'Скопировано', position: 'top', visibilityTime: 1500 });
};

const open = (url) => Linking.openURL(url).catch(() => {
  Toast.show({ type: 'error', text1: 'Не удалось открыть', text2: url, position: 'top' });
});

const ENTITY_TITLES = { url: 'Ссылка', email: 'Почта', phone: 'Телефон' };

// Касание: ссылка и почта открываются сразу, номер — выбор «Позвонить / Копировать» (как в Telegram)
const pressEntity = (entity) => {
  if (entity.type === 'url') open(linkHref(entity.value));
  else if (entity.type === 'email') open(`mailto:${entity.value}`);
  else if (entity.type === 'phone') {
    Alert.alert('Телефон', entity.value, [
      { text: 'Позвонить', onPress: () => open(phoneHref(entity.value)) },
      { text: 'Копировать', onPress: () => copy(entity.value) },
      { text: 'Отмена', style: 'cancel' },
    ]);
  }
};

// Долгое нажатие на ссылку — «Открыть / Копировать», а не меню сообщения
const longPressEntity = (entity) => {
  Haptics.selectionAsync().catch(() => {});
  const target = entity.type === 'url' ? linkHref(entity.value)
    : entity.type === 'email' ? `mailto:${entity.value}` : phoneHref(entity.value);
  Alert.alert(ENTITY_TITLES[entity.type] || 'Ссылка', entity.value, [
    { text: entity.type === 'phone' ? 'Позвонить' : 'Открыть', onPress: () => open(target) },
    { text: 'Копировать', onPress: () => copy(entity.value) },
    { text: 'Отмена', style: 'cancel' },
  ]);
};

/**
 * Текст сообщения или комментария, как в Telegram: ссылки, почта и телефоны нажимаются, упоминания подсвечены,
 * **жирный**, __курсив__, ~~зачёркнутый~~, `моноширинный`, ||скрытый|| (касание показывает).
 * interactive=false — копия в меню и режим выбора: ничего не нажимается.
 * children — дописывается в конец (невидимый хвост под время в пузырьке).
 */
export const RichText = ({ text, style, accentColor, codeBackground, interactive = true, children }) => {
  const pieces = useMemo(() => (hasRichContent(text) ? parseRichText(text) : null), [text]);
  const [revealed, setRevealed] = useState(false);
  const color = StyleSheet.flatten(style)?.color;

  if (!pieces) {
    return <Text style={style}>{text}{children}</Text>;
  }

  return (
    <Text style={style}>
      {pieces.map((piece, index) => {
        const { style: format, entity } = piece;
        const hidden = format.spoiler && !revealed;
        const pieceStyle = [
          format.bold && styles.bold,
          format.italic && styles.italic,
          format.strike && styles.strike,
          format.code && [styles.code, { backgroundColor: codeBackground }],
          entity && entity.type !== 'mention' && { color: accentColor },
          entity?.type === 'mention' && [styles.mention, { color: accentColor }],
          // Скрытый текст — сплошная плашка цвета текста, пока не коснутся
          hidden && { color: 'transparent', backgroundColor: color, borderRadius: 4 },
        ];
        const pressable = interactive && entity && entity.type !== 'mention' && !hidden;
        return (
          <Text
            key={index}
            style={pieceStyle}
            onPress={hidden && interactive ? () => setRevealed(true) : pressable ? () => pressEntity(entity) : undefined}
            onLongPress={pressable ? () => longPressEntity(entity) : undefined}
            suppressHighlighting={!pressable}
          >
            {piece.text}
          </Text>
        );
      })}
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through' },
  code: { fontFamily: MONO, fontSize: 15 },
  mention: { fontWeight: '600' },
});
