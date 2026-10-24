import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatFileSize } from '../../utils/chatFormat';
import { CachedImage } from '../ui/CachedImage';

const GRID_WIDTH = 240;
const GAP = 2;

/**
 * Фото и видео сообщения: одно — крупно, два — рядом, больше — сетка с «+N» на последней плитке.
 * onOpen(index) открывает полноэкранный просмотр.
 */
export const MediaGrid = ({ items, onOpen, onLongPress }) => {
  if (!items.length) return null;

  const shown = items.slice(0, 4);
  const hidden = items.length - shown.length;
  const single = shown.length === 1;
  const tileSize = single ? GRID_WIDTH : (GRID_WIDTH - GAP) / 2;

  return (
    <View style={[styles.grid, { width: GRID_WIDTH }]}>
      {shown.map((item, index) => {
        const isLastWithMore = hidden > 0 && index === shown.length - 1;
        // Три плитки: первая на всю ширину
        const wide = shown.length === 3 && index === 0;
        const width = wide ? GRID_WIDTH : tileSize;
        const height = single ? 200 : tileSize;

        return (
          <Pressable
            key={`${item.uri}-${index}`}
            onPress={() => onOpen(index)}
            onLongPress={onLongPress}
            delayLongPress={280}
            style={[styles.tile, { width, height }]}
            accessibilityRole="imagebutton"
            accessibilityLabel={item.type === 'video' ? 'Открыть видео' : 'Открыть фото'}
          >
            {item.type === 'video' ? (
              <View style={[styles.videoTile, { width, height }]}>
                <Ionicons name="play-circle" size={44} color="rgba(255,255,255,0.92)" />
              </View>
            ) : (
              <CachedImage uri={item.uri} style={{ width, height }} />
            )}
            {isLastWithMore ? (
              <View style={styles.more}>
                <Text style={styles.moreText}>+{hidden}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
};

const DOCUMENT_ICONS = {
  pdf: 'document-text',
  doc: 'document-text',
  docx: 'document-text',
  xls: 'grid',
  xlsx: 'grid',
  csv: 'grid',
  ppt: 'easel',
  pptx: 'easel',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
};

/** Документ: иконка по типу, имя и размер. Нажатие — скачать и открыть/поделиться. */
export const DocumentCard = ({ file, tint, textColor, metaColor, onPress, onLongPress }) => {
  const extension = (file.name || '').split('.').pop().toLowerCase();
  const icon = DOCUMENT_ICONS[extension] || 'document';

  return (
    <Pressable
      onPress={() => onPress(file)}
      onLongPress={onLongPress}
      delayLongPress={280}
      style={styles.document}
      accessibilityRole="button"
      accessibilityLabel={`Открыть файл ${file.name}`}
    >
      <View style={[styles.documentIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>
      <View style={styles.documentBody}>
        <Text style={[styles.documentName, { color: textColor }]} numberOfLines={2}>{file.name || 'Файл'}</Text>
        <Text style={[styles.documentMeta, { color: metaColor }]}>
          {[extension && extension.toUpperCase(), formatFileSize(file.size)].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, borderRadius: 14, overflow: 'hidden' },
  tile: { overflow: 'hidden', backgroundColor: '#2A2A30' },
  videoTile: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C1C21' },
  more: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  moreText: { color: '#FFFFFF', fontSize: 24, fontWeight: '600' },
  document: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, minWidth: 200, maxWidth: 260 },
  documentIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  documentBody: { flex: 1 },
  documentName: { fontSize: 15, fontWeight: '500' },
  documentMeta: { fontSize: 12, marginTop: 2 },
});
