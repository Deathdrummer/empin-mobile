import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { withAlpha } from '../../theme';
import { resolveMediaUri } from '../../utils/mediaUri';
import { CachedImage } from '../ui/CachedImage';

// Широкая картинка (обложка статьи) — во всю ширину под текстом, остальные — миниатюрой справа, как в Telegram
const WIDE_MIN_WIDTH = 400;
const WIDE_MIN_RATIO = 1.3;

/**
 * Превью ссылки в пузырьке: сайт, заголовок, описание, картинка. Касание открывает ссылку,
 * долгое нажатие — меню сообщения
 */
export const LinkPreviewCard = ({ preview, accentColor, textColor, disabled = false, onLongPress }) => {
  const imageUri = resolveMediaUri(preview.image);
  const ratio = preview.image_width && preview.image_height ? preview.image_width / preview.image_height : 0;
  const wide = Boolean(imageUri) && preview.image_width >= WIDE_MIN_WIDTH && ratio >= WIDE_MIN_RATIO;

  const open = () => Linking.openURL(preview.url).catch(() => {
    Toast.show({ type: 'error', text1: 'Не удалось открыть', text2: preview.url, position: 'top' });
  });

  return (
    <Pressable
      onPress={open}
      onLongPress={onLongPress}
      delayLongPress={280}
      disabled={disabled}
      style={[styles.card, { borderLeftColor: accentColor, backgroundColor: withAlpha(accentColor, 0.1) }]}
      accessibilityRole="link"
      accessibilityLabel={[preview.site, preview.title].filter(Boolean).join('. ')}
    >
      <View style={styles.row}>
        <View style={styles.body}>
          {preview.site ? <Text style={[styles.site, { color: accentColor }]} numberOfLines={1}>{preview.site}</Text> : null}
          {preview.title ? <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>{preview.title}</Text> : null}
          {preview.description ? (
            <Text style={[styles.description, { color: textColor }]} numberOfLines={wide ? 3 : 4}>{preview.description}</Text>
          ) : null}
        </View>
        {imageUri && !wide ? <CachedImage uri={imageUri} style={styles.thumb} /> : null}
      </View>
      {/* Высокая обложка обрезается до 3:2 — превью не должно занимать весь экран */}
      {wide ? <CachedImage uri={imageUri} style={[styles.wide, { aspectRatio: Math.min(Math.max(ratio, 1.5), 2.2) }]} /> : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: 6, borderLeftWidth: 3, borderRadius: 6, paddingVertical: 6, paddingLeft: 8, paddingRight: 8, gap: 6 },
  row: { flexDirection: 'row', gap: 8 },
  body: { flex: 1, gap: 2 },
  site: { fontSize: 14, fontWeight: '600' },
  title: { fontSize: 14, fontWeight: '600' },
  description: { fontSize: 14, lineHeight: 18 },
  thumb: { width: 56, height: 56, borderRadius: 6 },
  wide: { width: '100%', borderRadius: 6 },
});
