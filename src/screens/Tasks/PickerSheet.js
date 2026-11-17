import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '../../components/ui/Sheet';
import { useTheme, useThemedStyles } from '../../theme';

/**
 * Шторка выбора из списка в стиле приложения (как «Добавить объект» в табеле): поиск, группы, отметка выбранного.
 * Поиск по умолчанию — по строке `search` у элемента; onSearch — поиск на сервере (выбор объекта).
 *
 * sections: [{ key, title, data: [{ key, title, subtitle, meta, selected, search }] }]
 */
export const PickerSheet = ({
  visible,
  title,
  sections,
  loading = false,
  searchPlaceholder = 'Поиск',
  emptyText = 'Ничего не найдено',
  header = null,
  footer = null,
  onSearch,
  onSelect,
  onClose,
  onDismiss,
}) => {
  const theme = useTheme();
  const s = useThemedStyles(makeStyles);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const changeQuery = (text) => {
    setQuery(text);
    onSearch?.(text);
  };

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (onSearch || !needle) return (sections || []).filter((section) => section.data.length);
    return (sections || [])
      .map((section) => ({ ...section, data: section.data.filter((item) => (item.search || item.title || '').toLowerCase().includes(needle)) }))
      .filter((section) => section.data.length);
  }, [sections, query, onSearch]);

  return (
    <Sheet visible={visible} onClose={onClose} onDismiss={onDismiss} title={title} keyboard>
      {header}
      <View style={s.search}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder={searchPlaceholder}
          placeholderTextColor={theme.textMuted}
          value={query}
          onChangeText={changeQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => changeQuery('')} hitSlop={8} accessibilityLabel="Очистить поиск">
            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <View style={s.listWrapper}>
        <SectionList
          sections={shown}
          keyExtractor={(item) => String(item.key)}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (section.title ? <Text style={s.sectionTitle}>{section.title}</Text> : null)}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [s.item, pressed && { backgroundColor: theme.surfacePressed }]}
              onPress={() => onSelect(item)}
              accessibilityState={{ selected: !!item.selected }}
            >
              <View style={s.itemBody}>
                {item.meta ? <Text style={s.itemMeta}>{item.meta}</Text> : null}
                <Text style={s.itemTitle} numberOfLines={2}>{item.title}</Text>
                {item.subtitle ? <Text style={s.itemSubtitle} numberOfLines={2}>{item.subtitle}</Text> : null}
              </View>
              {item.selected ? <Ionicons name="checkmark" size={22} color={theme.accent} /> : null}
            </Pressable>
          )}
          ListEmptyComponent={loading ? null : <Text style={s.empty}>{emptyText}</Text>}
        />
        {loading ? (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : null}
      </View>
      {footer}
    </Sheet>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.inputBackground,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16, color: theme.text },
  // Постоянная высота: шторка не прыгает при поиске и переключении групп; с клавиатурой — сжимается
  listWrapper: { height: Math.round(Dimensions.get('window').height * 0.55), flexShrink: 1, minHeight: 160 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  itemBody: { flex: 1 },
  itemMeta: { fontSize: 13, fontWeight: '700', color: theme.accentText, marginBottom: 2 },
  itemTitle: { fontSize: 16, color: theme.text },
  itemSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  empty: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', paddingVertical: 32 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.veil,
  },
});
